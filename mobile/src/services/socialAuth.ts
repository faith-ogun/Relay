// Apple and Google sign-in, bridged into the same Firebase user the web app uses.
//
// APP STORE RULE THAT SHAPES THIS (Guideline 4.8): if an app offers any
// third-party sign-in (Google, Facebook, …) it MUST also offer Sign in with
// Apple. So Apple is not optional here — offering Google without it is a
// rejection at review. Email/password alone would not trigger the rule, but we
// want both, so both ship.
//
// Everything degrades honestly: an unavailable provider reports why rather than
// showing a button that does nothing.

import * as AppleAuthentication from 'expo-apple-authentication';
import * as AuthSession from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { GoogleAuthProvider, OAuthProvider, signInWithCredential } from 'firebase/auth';
import { auth } from './firebase';

WebBrowser.maybeCompleteAuthSession();

const googleClientId = (process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '').trim();

export type SocialResult =
  | { ok: true; isNewUser: boolean }
  | { ok: false; cancelled: true }
  | { ok: false; cancelled: false; message: string };

/** Apple only exists on iOS, and only on a device that supports it. */
export async function appleAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

export const googleConfigured = (): boolean => !!googleClientId;

/**
 * Sign in with Apple, then exchange the identity token for a Firebase session.
 *
 * A raw nonce is generated and its SHA-256 sent to Apple; Firebase then verifies
 * the raw value against the hash in the returned token. Skipping this is what
 * makes an Apple sign-in replayable.
 */
export async function signInWithApple(): Promise<SocialResult> {
  try {
    const rawNonce = Array.from(Crypto.getRandomBytes(16))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    const hashedNonce = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      rawNonce,
    );

    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });

    if (!credential.identityToken) {
      return { ok: false, cancelled: false, message: 'Apple did not return a sign-in token.' };
    }

    const provider = new OAuthProvider('apple.com');
    const firebaseCred = provider.credential({
      idToken: credential.identityToken,
      rawNonce,
    });
    const result = await signInWithCredential(auth, firebaseCred);

    // Apple returns the full name ONLY on the very first authorisation, so if we
    // do not capture it now it is gone for good.
    const given = credential.fullName?.givenName?.trim();
    if (given && !result.user.displayName) {
      const { updateProfile } = await import('firebase/auth');
      await updateProfile(result.user, { displayName: given });
    }

    const { getAdditionalUserInfo } = await import('firebase/auth');
    return { ok: true, isNewUser: getAdditionalUserInfo(result)?.isNewUser === true };
  } catch (e) {
    const code = (e as { code?: string })?.code ?? '';
    if (code === 'ERR_REQUEST_CANCELED' || code === 'ERR_CANCELED') {
      return { ok: false, cancelled: true };
    }
    return { ok: false, cancelled: false, message: 'Apple sign-in did not complete.' };
  }
}

/**
 * Google via the system browser (expo-auth-session), so it works in Expo Go
 * without a native module. Needs an iOS OAuth client id from the Firebase
 * console; without one the button is hidden rather than shown broken.
 */
export async function signInWithGoogle(): Promise<SocialResult> {
  if (!googleClientId) {
    return { ok: false, cancelled: false, message: 'Google sign-in is not configured yet.' };
  }
  try {
    const redirectUri = AuthSession.makeRedirectUri({ scheme: 'ohmlet' });
    const request = new AuthSession.AuthRequest({
      clientId: googleClientId,
      scopes: ['openid', 'profile', 'email'],
      redirectUri,
      responseType: AuthSession.ResponseType.IdToken,
      extraParams: { nonce: 'ohmlet' },
    });
    const discovery = await AuthSession.fetchDiscoveryAsync('https://accounts.google.com');
    const result = await request.promptAsync(discovery);

    if (result.type === 'cancel' || result.type === 'dismiss') {
      return { ok: false, cancelled: true };
    }
    if (result.type !== 'success' || !result.params.id_token) {
      return { ok: false, cancelled: false, message: 'Google sign-in did not complete.' };
    }

    const cred = GoogleAuthProvider.credential(result.params.id_token);
    const signed = await signInWithCredential(auth, cred);
    const { getAdditionalUserInfo } = await import('firebase/auth');
    return { ok: true, isNewUser: getAdditionalUserInfo(signed)?.isNewUser === true };
  } catch {
    return { ok: false, cancelled: false, message: 'Google sign-in did not complete.' };
  }
}
