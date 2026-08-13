// ── Legal + policy content ──
//
// Structured so one <LegalPage> component renders all three documents with a
// table of contents, anchored sections, and consistent styling.
//
// IMPORTANT: these are well-researched, product-specific drafts, not a lawyer's
// final word. Have them reviewed before launch (task #99).
//
// THE RULE FOR THIS FILE: it may only describe what the code ACTUALLY does
// today. A privacy policy is a binding representation, so a promise the product
// does not keep is a legal exposure, not a nice-to-have. Two were found and
// removed in the 2026-08 audit: it claimed session transcripts were stored for
// the user to review (they are client-side React state and are never persisted)
// and that the camera is off by default (a session auto-enables it for adults).
// The children's section is gated on the same flag as the feature it describes,
// so the published policy cannot promise a gate that is switched off.
//
// CONTROLLER IDENTITY (GDPR Art 13): section 1 names Ohmlet, states plainly that
// it is an unincorporated service operated from Ireland, gives a monitored email
// as the contact point, and undertakes to provide full controller details in
// writing on request. That is a deliberate founder decision: no personal name and
// no home address on a public, scrapeable page while Ohmlet is a sole trader.
//
// It is a defensible position for a small online service, NOT a settled one. A
// regulator may expect a named controller and a postal address. Two things
// close it properly, and both belong to the solicitor review in task #99:
//   1. incorporating, after which the company name and registered address go here;
//   2. or a registered/virtual address if launching before that.
// Revisit if a user, a regulator, or a business partner asks for it.

import { CHILD_MODE_ENABLED } from '../ohmlet/childmode/ageModel';

export const POLICY_UPDATED = 'August 13, 2026';
export const CONTACT_EMAIL = 'hello@ohmlet.org';
// Points at the single mailbox that actually exists. A dedicated privacy@ alias
// was published across the policy before one had been created: an address nobody
// reads is worse than no address, because data-rights requests sent there would
// bounce or vanish, and answering them is a legal obligation with a deadline.
// When a privacy@ alias exists, change this one line.
export const PRIVACY_EMAIL = CONTACT_EMAIL;

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

// Rendered ONLY when child mode is switched on, because it describes protections
// that only exist behind that flag. Publishing it while the flag is off would
// promise a parental-consent gate that is not running.
const CHILDREN_SECTION_LIVE: LegalSection = {
  id: 'children',
    heading: '10. Children, and parental consent',
    blocks: [
      { type: 'p', text: 'Ohmlet is for learners of all ages, with extra care built in for younger builders. This section explains how we handle a child\'s data and how a parent or guardian gives consent. It applies wherever Ohmlet offers accounts to people below the age of digital consent.' },
      { type: 'sub', text: 'Working out the right protections' },
      { type: 'p', text: 'When you set up an account we ask for your birth year and country. We use these only to work out the age of digital consent that applies to you, which ranges from 13 to 16 depending on where you live. We ask for the birth year, never a full date of birth.' },
      { type: 'sub', text: 'If a learner is below the age of digital consent' },
      { type: 'p', text: 'A parent or guardian must set up the account and give verifiable parental consent before the live camera-and-voice tutor is switched on. Until that consent is verified, the live tutor stays off. For these accounts the parent or guardian is treated as the account holder and agrees to our Terms on the child\'s behalf.' },
      { type: 'sub', text: 'How a parent gives consent' },
      { type: 'p', text: 'We use a verifiable method that confirms an adult is giving consent. Today that is a small card verification handled by our payment processor (Stripe) that confirms an adult payment method through your bank\'s security check; it does not charge you. We may add further approved methods over time. We keep a record that consent was given, so we can honour a parent\'s rights and prove consent if asked.' },
      { type: 'sub', text: 'What we collect from younger learners, and what we do not' },
      {
        type: 'list',
        items: [
          'We minimise what we collect: the birth year (not a full date of birth), the account basics needed to sign in, and learning progress.',
          'The tutor is instructed never to ask a child for personal information (such as full name, address, school, or contact details), and to steer back to the build if a child shares any.',
          'The camera is off by default. When it is on, we send periodic snapshots, never a stored video, and we do not keep raw video.',
          'We do not use a child\'s data for advertising, we do not build advertising profiles, and the tutor does not infer or react to a child\'s emotions.',
          'Community features are restricted for children\'s accounts.',
        ],
      },
      { type: 'sub', text: 'Children in the United States (COPPA)' },
      { type: 'p', text: 'For children under 13 in the United States, we comply with the Children\'s Online Privacy Protection Act (COPPA). We obtain verifiable parental consent before collecting personal information from a child, we collect only what is needed for the tutor to work, and a parent can review their child\'s information, ask us to delete it, and refuse to allow any further collection at any time.' },
      { type: 'sub', text: 'Parent and guardian rights' },
      { type: 'p', text: `A parent or guardian can, at any time, review the personal information we hold about their child, ask us to delete it, and withdraw consent, which switches the live tutor back off. Email ${PRIVACY_EMAIL} and we will help. If you believe a child has used Ohmlet without the consent this section requires, contact us and we will remove their information.` },
    ],
};

// What the published policy says while child mode is OFF. It must describe the
// product as it actually is: there is no age gate today, so we cannot claim one.
const CHILDREN_SECTION_TODAY: LegalSection = {
  id: 'children',
  heading: '10. Children',
  blocks: [
    { type: 'p', text: 'Ohmlet is intended for adults and for learners at or above the age of digital consent where they live, which ranges from 13 to 16 across Europe. We do not currently offer accounts designed for children below that age.' },
    { type: 'p', text: `We do not knowingly collect personal data from a child below the age of digital consent. If you are a parent or guardian and believe a child has created an account or given us personal data, contact us at ${PRIVACY_EMAIL} and we will delete it promptly.` },
    { type: 'p', text: 'We are building a supervised experience for younger builders, with verifiable parental consent before the live camera-and-voice tutor can be used. When it is available this section will be replaced with the full detail, and we will tell existing users before anything changes.' },
  ],
};

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
          text: 'Ohmlet ("we", "us", "our") provides a live, voice and camera AI tutor for learning electronics by building. For the purposes of data protection law, Ohmlet is the data controller for the personal data described in this policy. Ohmlet is an independent service operated from Ireland, and is not yet incorporated as a company.',
        },
        {
          type: 'p',
          text: `The fastest way to reach us about anything in this policy, including any request about your data, is ${PRIVACY_EMAIL}. We answer from a monitored mailbox and will respond within the time limits the law sets. If you need our full controller details in writing, for example to make a formal complaint or a legal request, email us and we will provide them.`,
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
        { type: 'p', text: 'When you start a live tutor session, we process audio from your microphone and periodic still images (snapshots) from your camera so the tutor can hear and see your workbench. A live text transcript appears in your browser during the session so you can follow along; we do not store it, and it is gone when the session ends. See section 4 for exactly how this works.' },
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
            'Nothing starts until you do. A live session only begins when you press Go live, and your browser asks your permission for the microphone and camera before either is used. When you start a session both are switched on, because the tutor needs to hear you and see your bench; you can mute the microphone or turn the camera off at any point during the session, or end it outright.',
            'When the camera is on, we send periodic still snapshots (not a continuous video recording) to power the tutor, alongside your audio.',
            'We do not store raw video. Snapshots are processed to give you guidance and are not retained as a video file.',
            'The conversation transcript is rendered live in your browser only. We do not send it to our servers and we do not store it, so it disappears when the session ends. We do keep usage metrics such as session length.',
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
            'Live session transcripts: not retained at all. They exist only in your browser while the session is open.',
            'Usage metrics (such as session length): for a limited period, to run the service and improve it.',
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
    CHILD_MODE_ENABLED ? CHILDREN_SECTION_LIVE : CHILDREN_SECTION_TODAY,
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
        // Mirrors the Privacy Policy: only assert the parental-consent route when
        // the feature that implements it is switched on.
        ...(CHILD_MODE_ENABLED
          ? [
              { type: 'p', text: 'Ohmlet is for learners of all ages. If you are at or above the age of digital consent in your country, which is between 13 and 16 depending on where you live, you can hold your own account.' } as LegalBlock,
              { type: 'p', text: 'If you are below that age, a parent or guardian must set up the account for you, give verifiable consent, and agree to these terms as the contracting party on your behalf. They are responsible for supervising your use of Ohmlet. The live camera-and-voice tutor stays switched off until that consent is verified. How we ask for and verify a parent\'s consent, and the extra protections that apply to a child\'s account, are described in our Privacy Policy.' } as LegalBlock,
            ]
          : [
              { type: 'p', text: 'You must be at or above the age of digital consent in your country, which is between 13 and 16 depending on where you live, to hold an Ohmlet account. Accounts designed for younger builders, with verifiable parental consent, are not available yet.' } as LegalBlock,
              { type: 'p', text: 'To buy a subscription you must be 18 or over, or have a parent or guardian make the purchase for you.' } as LegalBlock,
            ]),
        { type: 'p', text: 'Working with real electronics may need adult help whatever your age; please read the safety section (section 9).' },
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
        { type: 'p', text: 'Essential cookies are always on, because the app cannot work without them. Analytics cookies are off by default: we ask for your consent through a cookie banner the first time you visit, and they stay off unless you choose Accept. You can change your choice at any time from the Cookie settings link in the footer.' },
      ],
    },
    {
      id: 'managing',
      heading: '4. Managing cookies',
      blocks: [
        { type: 'p', text: 'You can accept or reject non-essential cookies through our cookie banner, with reject as easy as accept, and change your choice at any time using the Cookie settings link in the footer. You can also control cookies in your browser settings, including blocking or deleting them. Note that blocking essential cookies will stop you from signing in and using the app.' },
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
