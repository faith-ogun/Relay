// ── Legal + policy content ──
//
// Structured so one <LegalPage> component renders all three documents with a
// table of contents, anchored sections, and consistent styling.
//
// IMPORTANT: these are well-researched, product-specific drafts, not a lawyer's
// final word. Have them reviewed before launch, and fill in the registered
// company details once the entity is incorporated.

export const POLICY_UPDATED = 'June 18, 2026';
export const CONTACT_EMAIL = 'hello@ohmlet.org';
export const PRIVACY_EMAIL = 'privacy@ohmlet.org';

export type LegalBlock =
  | { type: 'p'; text: string }
  | { type: 'sub'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'table'; head: string[]; rows: string[][] };

export interface LegalSection {
  id: string;
  heading: string;
  blocks: LegalBlock[];
}

export interface LegalDoc {
  slug: 'terms' | 'privacy' | 'cookies';
  title: string;
  tagline: string;
  intro: string;
  sections: LegalSection[];
}

// ─────────────────────────────────────────────────────────────────────────────
// PRIVACY POLICY
// ─────────────────────────────────────────────────────────────────────────────

export const PRIVACY: LegalDoc = {
  slug: 'privacy',
  title: 'Privacy Policy',
  tagline: 'What we collect, why, and the control you have over it.',
  intro:
    'This policy explains what personal data Ohmlet collects when you use our website and app, how we use it, who we share it with, and the rights you have. We have tried to write it in plain language. If anything is unclear, email us and we will explain.',
  sections: [
    {
      id: 'who-we-are',
      heading: '1. Who we are',
      blocks: [
        {
          type: 'p',
          text: 'Ohmlet ("we", "us", "our") provides a live, voice and camera AI tutor for learning electronics by building. For the purposes of data protection law, Ohmlet is the data controller for the personal data described in this policy. Ohmlet is operated from Ireland; our registered company details will be listed here once incorporation completes.',
        },
        {
          type: 'p',
          text: `You can reach us about anything in this policy at ${PRIVACY_EMAIL}.`,
        },
      ],
    },
    {
      id: 'what-we-collect',
      heading: '2. What we collect',
      blocks: [
        { type: 'sub', text: 'Account information' },
        { type: 'p', text: 'Your name, email address, and the credentials you use to sign in. If you sign in with Google, we receive your basic profile and email from Google, not your password.' },
        { type: 'sub', text: 'Learning data' },
        { type: 'p', text: 'Your progress through lessons and builds, XP, streaks, achievements, quiz answers, and anything you post to the community.' },
        { type: 'sub', text: 'Live session data (camera and microphone)' },
        { type: 'p', text: 'When you start a live tutor session, we process audio from your microphone and periodic still images (snapshots) from your camera so the tutor can hear and see your workbench. We also keep a text transcript of the session so you can review it. See section 4 for exactly how this works.' },
        { type: 'sub', text: 'Payment information' },
        { type: 'p', text: 'If you subscribe, your payment is handled by Stripe. We receive confirmation of your plan and status, but we do not store your full card number; Stripe does that as a payment processor.' },
        { type: 'sub', text: 'Technical and usage data' },
        { type: 'p', text: 'Device and browser type, approximate region, and how you interact with the app, used to keep the service secure and to improve it. We also record usage of the live tutor (such as minutes used) to operate fair-use limits and manage cost.' },
      ],
    },
    {
      id: 'how-we-use',
      heading: '3. How we use your data, and our lawful bases',
      blocks: [
        { type: 'p', text: 'We use your data to provide and improve Ohmlet, on the following lawful bases under the GDPR:' },
        {
          type: 'list',
          items: [
            'To deliver the service you ask for (lessons, the live tutor, your account): performance of our contract with you.',
            'To process payments and manage subscriptions: performance of our contract, and compliance with legal obligations such as tax.',
            'To keep the service secure, prevent abuse, and operate fair-use limits: our legitimate interests.',
            'To understand and improve how features are used: our legitimate interests, or your consent where required (for example, analytics cookies).',
            'To send you service messages: performance of our contract. To send optional product updates: your consent, which you can withdraw at any time.',
          ],
        },
      ],
    },
    {
      id: 'live-tutor',
      heading: '4. The live tutor: your camera and microphone',
      blocks: [
        { type: 'p', text: 'The live tutor is the heart of Ohmlet, and it is also the most sensitive data we handle, so we want to be precise about it.' },
        {
          type: 'list',
          items: [
            'The camera is off by default. A session is voice-first; you choose when to turn the camera on, and you can turn it off or end the session at any time.',
            'When the camera is on, we send periodic still snapshots (not a continuous video recording) to power the tutor, alongside your audio.',
            'We do not store raw video. Snapshots are processed to give you guidance and are not retained as a video file.',
            'We keep the text transcript of the conversation so you can review your session and so we can support you, and we keep usage metrics such as session length.',
            'Point the camera at your workbench, not at people or anything private. You are in control of what is in frame.',
          ],
        },
      ],
    },
    {
      id: 'ai',
      heading: '5. AI features and your data',
      blocks: [
        { type: 'p', text: 'To power the tutor, your audio and camera snapshots are sent to Google\'s Gemini models through Google Cloud (Vertex AI) for real-time processing. This is what lets the tutor see and talk.' },
        {
          type: 'list',
          items: [
            'This data is used only to provide tutoring during your session.',
            'We do not use your session content to train our own models.',
            'Under our Google Cloud terms, your content is not used to train Google\'s foundation models.',
            'Code generation and explanations are produced by AI and can occasionally be wrong; always apply basic electronics safety (see our Terms).',
          ],
        },
      ],
    },
    {
      id: 'sharing',
      heading: '6. Who we share data with',
      blocks: [
        { type: 'p', text: 'We do not sell your personal data. We share it only with the service providers (sub-processors) that help us run Ohmlet, each under contract and only as needed:' },
        {
          type: 'table',
          head: ['Provider', 'What they do for us'],
          rows: [
            ['Google Cloud / Firebase', 'Hosting, authentication, database, and the Gemini AI that powers the tutor'],
            ['Stripe', 'Payment processing and subscription management'],
            ['Email provider', 'Sending account and service emails'],
          ],
        },
        { type: 'p', text: 'Anything you post to the community (such as a shared build) is visible to other users by design. Do not post anything you want to keep private.' },
      ],
    },
    {
      id: 'transfers',
      heading: '7. International transfers',
      blocks: [
        { type: 'p', text: 'We aim to store and process data in the European Union where possible. Some of our providers, including Google and Stripe, may process data outside the EU, including in the United States. Where that happens, the transfer is protected by appropriate safeguards such as the European Commission\'s Standard Contractual Clauses.' },
      ],
    },
    {
      id: 'retention',
      heading: '8. How long we keep it',
      blocks: [
        { type: 'p', text: 'We keep your personal data only as long as we need it for the purposes above. In practice:' },
        {
          type: 'list',
          items: [
            'Account and learning data: while your account is active, and for a short period after you delete it, to handle any final issues.',
            'Session transcripts and usage metrics: for a limited period to provide your history and improve the service.',
            'Payment and billing records: as long as tax and accounting law requires.',
          ],
        },
        { type: 'p', text: 'When you delete your account, we delete or anonymise your personal data, except where we must keep some records by law.' },
      ],
    },
    {
      id: 'rights',
      heading: '9. Your rights',
      blocks: [
        { type: 'p', text: 'Under the GDPR you have the right to:' },
        {
          type: 'list',
          items: [
            'Access the personal data we hold about you, and get a copy (portability).',
            'Correct data that is wrong or incomplete.',
            'Delete your data ("right to be forgotten").',
            'Object to or restrict certain processing.',
            'Withdraw consent at any time, where we relied on consent.',
          ],
        },
        { type: 'p', text: `To exercise any of these, email ${PRIVACY_EMAIL}. You can also export or delete your data from your account settings. If you believe we have mishandled your data, you have the right to complain to the Irish Data Protection Commission (dataprotection.ie), or your local supervisory authority.` },
      ],
    },
    {
      id: 'children',
      heading: '10. Children',
      blocks: [
        { type: 'p', text: 'Ohmlet is intended for users aged 16 and over. If you are under the age of digital consent in your country, you may only use Ohmlet with the consent and involvement of a parent or guardian. We do not knowingly collect data from children below that age without such consent; if you believe we have, contact us and we will remove it.' },
      ],
    },
    {
      id: 'security',
      heading: '11. How we protect your data',
      blocks: [
        { type: 'p', text: 'We use encryption in transit, access controls, and reputable infrastructure (Google Cloud) to protect your data. No system is perfectly secure, but we take protection seriously and will notify you and the relevant authority of a qualifying breach within the timeframes the law requires.' },
      ],
    },
    {
      id: 'changes',
      heading: '12. Changes to this policy',
      blocks: [
        { type: 'p', text: 'We may update this policy as the product evolves. We will change the "last updated" date above and, for significant changes, let you know in the app or by email.' },
      ],
    },
    {
      id: 'contact',
      heading: '13. Contact us',
      blocks: [
        { type: 'p', text: `Questions about your privacy? Email ${PRIVACY_EMAIL} and a real person will get back to you.` },
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// TERMS OF SERVICE
// ─────────────────────────────────────────────────────────────────────────────

export const TERMS: LegalDoc = {
  slug: 'terms',
  title: 'Terms of Service',
  tagline: 'The agreement between you and Ohmlet.',
  intro:
    'These terms govern your use of Ohmlet. By creating an account or using the app, you agree to them. Please read the safety and AI sections in particular, because Ohmlet helps you work with real electronics.',
  sections: [
    {
      id: 'agreement',
      heading: '1. Agreement to these terms',
      blocks: [
        { type: 'p', text: 'By accessing or using Ohmlet, you agree to these Terms of Service and to our Privacy Policy and Cookie Policy. If you do not agree, please do not use Ohmlet.' },
      ],
    },
    {
      id: 'eligibility',
      heading: '2. Eligibility and age',
      blocks: [
        { type: 'p', text: 'You must be at least 16 years old to use Ohmlet on your own. If you are under the age of digital consent in your country, you may use Ohmlet only with the consent and supervision of a parent or guardian, who agrees to these terms on your behalf. Working with electronics may require adult supervision regardless of age.' },
      ],
    },
    {
      id: 'account',
      heading: '3. Your account',
      blocks: [
        { type: 'p', text: 'You are responsible for keeping your login secure and for activity under your account. Tell us promptly if you suspect unauthorised use. Provide accurate information and keep it up to date.' },
      ],
    },
    {
      id: 'subscriptions',
      heading: '4. Subscriptions, billing, and cancellation',
      blocks: [
        {
          type: 'list',
          items: [
            'Ohmlet offers a Free tier and paid plans (Pro and max). Current prices are shown on our pricing page.',
            'Paid plans are billed in advance on a recurring basis (monthly or annually) and renew automatically until you cancel.',
            'You can cancel at any time from your account; your plan stays active until the end of the period you have paid for, and you will not be charged again after that.',
            'Except where required by law, payments are non-refundable for partial periods. We may offer refunds at our discretion.',
            'We may change prices; we will give you reasonable notice and changes will not affect the period you have already paid for.',
          ],
        },
      ],
    },
    {
      id: 'free-limits',
      heading: '5. Free tier and fair use',
      blocks: [
        { type: 'p', text: 'The live tutor has a real per-minute cost to run, so each plan includes a fair-use allowance of live tutoring time. We may meter and limit live sessions according to your plan, and we enforce these limits to keep the service sustainable for everyone. Lessons and self-paced features are not limited in this way.' },
      ],
    },
    {
      id: 'acceptable-use',
      heading: '6. Acceptable use',
      blocks: [
        { type: 'p', text: 'When using Ohmlet you agree not to:' },
        {
          type: 'list',
          items: [
            'Break the law or help others do so.',
            'Misuse, overload, reverse engineer, or try to bypass limits or security of the service.',
            'Upload harmful, abusive, infringing, or illegal content, or harass other users in the community.',
            'Use the service to build anything dangerous, weaponised, or intended to cause harm.',
            'Resell or commercially exploit the service without our permission.',
          ],
        },
      ],
    },
    {
      id: 'your-content',
      heading: '7. Your content and the community',
      blocks: [
        { type: 'p', text: 'You keep ownership of the content you create and post, such as community posts and shared builds. By posting, you grant us a licence to host, display, and share that content within Ohmlet so the service can work. You are responsible for what you post, and you confirm you have the right to post it. We may remove content that breaches these terms.' },
      ],
    },
    {
      id: 'ip',
      heading: '8. Our intellectual property',
      blocks: [
        { type: 'p', text: 'Ohmlet, including the software, curriculum, brand, the Ohmlet mascot, and the look and feel, belongs to us and our licensors. We grant you a personal, limited, non-transferable licence to use Ohmlet for learning. You may not copy, resell, or create derivative products from it without permission.' },
      ],
    },
    {
      id: 'safety',
      heading: '9. AI guidance and electronics safety',
      blocks: [
        { type: 'p', text: 'This section matters. Ohmlet guides you through real electronics, and its guidance is generated with AI.' },
        {
          type: 'list',
          items: [
            'AI guidance can be incomplete or wrong. Use your own judgement and verify before you power on a circuit.',
            'You are responsible for working safely: follow standard electronics safety, use appropriate components and power sources, and stop if something gets hot, smells, or behaves unexpectedly.',
            'Do not rely on Ohmlet for high-voltage, mains, or any potentially hazardous work. Ohmlet is designed for low-voltage hobby electronics such as Arduino projects.',
            'Adult supervision is recommended for younger learners, and required for anything beyond low-voltage hobby work.',
            'You build at your own risk. To the extent the law allows, we are not liable for damage to components, equipment, or property arising from your builds.',
          ],
        },
      ],
    },
    {
      id: 'third-party',
      heading: '10. Third-party services',
      blocks: [
        { type: 'p', text: 'Ohmlet relies on third parties such as Google Cloud and Stripe. Your use of those parts is also subject to their terms. We are not responsible for third-party services we do not control.' },
      ],
    },
    {
      id: 'disclaimers',
      heading: '11. Disclaimers',
      blocks: [
        { type: 'p', text: 'Ohmlet is provided "as is" and "as available". To the fullest extent permitted by law, we disclaim implied warranties of merchantability, fitness for a particular purpose, and non-infringement. We do not guarantee the service will be uninterrupted, error-free, or that the AI will always be accurate.' },
      ],
    },
    {
      id: 'liability',
      heading: '12. Limitation of liability',
      blocks: [
        { type: 'p', text: 'To the extent permitted by law, Ohmlet is not liable for indirect, incidental, or consequential losses, or for loss of data or profits. Nothing in these terms limits liability that cannot be limited by law, such as for death or personal injury caused by negligence. Where liability is permitted to be capped, our total liability is limited to the amount you paid us in the 12 months before the claim.' },
      ],
    },
    {
      id: 'termination',
      heading: '13. Termination',
      blocks: [
        { type: 'p', text: 'You can stop using Ohmlet and delete your account at any time. We may suspend or end your access if you breach these terms or to protect the service and other users. Sections that by their nature should survive termination (such as intellectual property, disclaimers, and liability) will continue to apply.' },
      ],
    },
    {
      id: 'changes',
      heading: '14. Changes to the service and these terms',
      blocks: [
        { type: 'p', text: 'We are actively building Ohmlet, so features may change, and some are labelled Beta. We may update these terms; we will update the date above and, for significant changes, notify you. Continuing to use Ohmlet after a change means you accept the updated terms.' },
      ],
    },
    {
      id: 'law',
      heading: '15. Governing law',
      blocks: [
        { type: 'p', text: 'These terms are governed by the laws of Ireland, and the courts of Ireland have jurisdiction, without affecting any mandatory consumer protections you have where you live.' },
      ],
    },
    {
      id: 'contact',
      heading: '16. Contact us',
      blocks: [
        { type: 'p', text: `Questions about these terms? Email ${CONTACT_EMAIL}.` },
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// COOKIE POLICY
// ─────────────────────────────────────────────────────────────────────────────

export const COOKIES: LegalDoc = {
  slug: 'cookies',
  title: 'Cookie Policy',
  tagline: 'The small files that keep you signed in, and the choices you have.',
  intro:
    'This policy explains how Ohmlet uses cookies and similar technologies, what each type is for, and how you can control them. It works alongside our Privacy Policy.',
  sections: [
    {
      id: 'what',
      heading: '1. What cookies are',
      blocks: [
        { type: 'p', text: 'Cookies are small text files a website stores on your device. They let the site remember things between pages and visits, such as the fact that you are signed in. We also use similar technologies like local storage for the same purposes; we refer to all of them as "cookies" here.' },
      ],
    },
    {
      id: 'how',
      heading: '2. How we use cookies',
      blocks: [
        { type: 'p', text: 'We use cookies to keep you signed in and secure, to remember your preferences, and, where you allow it, to understand how the app is used so we can improve it. We do not use advertising cookies and we do not sell your data.' },
      ],
    },
    {
      id: 'categories',
      heading: '3. The categories we use',
      blocks: [
        {
          type: 'table',
          head: ['Category', 'What it does', 'Consent needed'],
          rows: [
            ['Essential', 'Sign-in, security, keeping your session, and remembering your place in a build. The app cannot work without these.', 'No, always on'],
            ['Preferences', 'Remembering choices such as your view or settings.', 'Yes, where required'],
            ['Analytics', 'Understanding, in aggregate, how features are used so we can improve them.', 'Yes'],
          ],
        },
        { type: 'p', text: 'Today Ohmlet uses primarily essential cookies. If and when we add preference or analytics cookies, we will ask for your consent first through a cookie banner, and non-essential cookies will stay off until you agree.' },
      ],
    },
    {
      id: 'managing',
      heading: '4. Managing cookies',
      blocks: [
        { type: 'p', text: 'When we use non-essential cookies, you will be able to accept or reject them through our cookie banner, with reject as easy as accept, and change your choice later. You can also control cookies in your browser settings, including blocking or deleting them. Note that blocking essential cookies will stop you from signing in and using the app.' },
      ],
    },
    {
      id: 'third-party',
      heading: '5. Third-party cookies',
      blocks: [
        { type: 'p', text: 'Some providers we use, such as Stripe for payments and Google for sign-in and infrastructure, may set their own cookies when you use those features, to keep them working and secure. Their use of cookies is governed by their own policies.' },
      ],
    },
    {
      id: 'changes',
      heading: '6. Changes to this policy',
      blocks: [
        { type: 'p', text: 'We will update this policy as our use of cookies changes, and update the date above.' },
      ],
    },
    {
      id: 'contact',
      heading: '7. Contact us',
      blocks: [
        { type: 'p', text: `Questions about cookies? Email ${CONTACT_EMAIL}.` },
      ],
    },
  ],
};

export const LEGAL_DOCS: Record<LegalDoc['slug'], LegalDoc> = {
  terms: TERMS,
  privacy: PRIVACY,
  cookies: COOKIES,
};
