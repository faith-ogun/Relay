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
 * Google via the system browser (expo-auth-session), so no native module is
 * needed. Without an iOS client id the button is hidden rather than shown
 * broken.
 *
 * Two things here are specific to a Google *iOS* OAuth client and are easy to
 * get wrong:
 *
 *   - The redirect must be the REVERSED client id scheme. Google rejects a
 *     custom scheme like `ohmlet://` for an iOS client type, so the app also
 *     registers that scheme (see `app.json`) or iOS has nowhere to deliver the
 *     callback.
 *   - The nonce must be fresh per request. It was a constant, which is the same
 *     as having none: the whole point is that an id token captured from one
 *     sign-in cannot be replayed into another.
 */
export async function signInWithGoogle(): Promise<SocialResult> {
  if (!googleClientId) {
    return { ok: false, cancelled: false, message: 'Google sign-in is not configured yet.' };
  }
  try {
    // `<reversed>:/oauth2redirect` is the form Google's iOS clients require.
    const reversed = googleClientId.split('.apps.googleusercontent.com')[0];
    const redirectUri = `com.googleusercontent.apps.${reversed}:/oauth2redirect`;
    const nonce = Array.from(Crypto.getRandomBytes(16))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    const discovery = await AuthSession.fetchDiscoveryAsync('https://accounts.google.com');

    const request = new AuthSession.AuthRequest({
      clientId: googleClientId,
      scopes: ['openid', 'profile', 'email'],
      redirectUri,
      // Authorization CODE plus PKCE, which is what Google supports for an
      // installed app (RFC 8252). Asking for an id_token directly is the
      // implicit flow, and Google does not accept it from a client of type iOS:
      // it rejects the request outright with "Access blocked: Authorisation
      // Error". Turning PKCE off silenced the parameter it complained about but
      // left the flow itself wrong, which is why the error came back.
      responseType: AuthSession.ResponseType.Code,
      usePKCE: true,
      extraParams: {
        nonce,
        // Without this Google reuses whichever account the system browser is
        // already signed into, so someone with several is never asked.
        prompt: 'select_account',
      },
    });

    const result = await request.promptAsync(discovery);
    if (result.type === 'cancel' || result.type === 'dismiss') {
      return { ok: false, cancelled: true };
    }
    if (result.type !== 'success' || !result.params.code) {
      return { ok: false, cancelled: false, message: 'Google sign-in did not complete.' };
    }

    // Exchange the code for tokens. An iOS client is public, so there is no
    // client secret; the PKCE verifier is what proves this is the same app that
    // started the flow.
    const tokens = await AuthSession.exchangeCodeAsync(
      {
        clientId: googleClientId,
        code: result.params.code,
        redirectUri,
        extraParams: { code_verifier: request.codeVerifier ?? '' },
      },
      discovery,
    );

    if (!tokens.idToken) {
      return { ok: false, cancelled: false, message: 'Google sign-in did not complete.' };
    }

    const cred = GoogleAuthProvider.credential(tokens.idToken);
    const signed = await signInWithCredential(auth, cred);
    const { getAdditionalUserInfo } = await import('firebase/auth');
    return { ok: true, isNewUser: getAdditionalUserInfo(signed)?.isNewUser === true };
  } catch (e) {
    // The message is surfaced rather than swallowed: "did not complete" told
    // nobody anything, and this flow has several distinct ways to fail.
    const detail = e instanceof Error ? e.message : '';
    return {
      ok: false,
      cancelled: false,
      message: detail ? `Google sign-in failed: ${detail}` : 'Google sign-in did not complete.',
    };
  }
}

