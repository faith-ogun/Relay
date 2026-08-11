// Child-mode notices — the plain-language counterparts to the formal Terms /
// Privacy sections (legal/content.ts §10 / §2). Kept as structured content so the
// parent notice (COPPA "direct notice to parents" + GDPR-K parent information) and
// the child-readable notice are defined once and can't drift from the policy.
//
// These render only inside the child-mode flow, which is gated by
// VITE_OHMLET_CHILD_MODE, so nothing here appears until child mode is switched on.

export const PRIVACY_CONTACT = 'privacy@ohmlet.org';

export interface NoticeSection {
  heading: string;
  body?: string;
  points?: string[];
}

export interface ParentNotice {
  title: string;
  intro: string;
  sections: NoticeSection[];
  closing: string;
}

// Shown to the adult during the consent flow. Mirrors Privacy §10 in a warmer,
// scannable register, and covers the COPPA direct-notice-to-parents points: what
// we collect, why, that we need their consent first, and their review / revoke rights.
export const PARENT_NOTICE: ParentNotice = {
  title: 'For parents and guardians',
  intro:
    'Ohmlet is a friendly AI tutor that helps your child learn electronics by building real circuits. During a live session it can hear your child and see their workbench through the camera, and it guides them step by step. Because your child is below the age of digital consent where you live, the law asks us to bring you in and get your okay before the live tutor turns on.',
  sections: [
    {
      heading: 'What Ohmlet collects from your child',
      points: [
        'Their birth year and country, to apply the right protections. We never ask for a full date of birth.',
        'The basics to sign in, and their learning progress (builds, XP, streaks).',
        'During a live session: microphone audio, periodic still snapshots of the workbench (never a stored video), and a text transcript so the session can be reviewed.',
      ],
    },
    {
      heading: 'How we keep your child safe',
      points: [
        'The camera is off by default, and a session is voice-first. Your child chooses when it goes on.',
        'The tutor sticks to low-voltage battery and USB builds, and refuses anything with mains power, hot tools, or anything that could hurt, pointing back to you instead.',
        'The tutor never asks your child for personal details, and does not track or react to their mood.',
        'Content safety is set to its strictest level, community features are restricted, and we keep a child\'s data for a shorter time.',
        'The tutor is clear that it is a computer helper, not a real person.',
      ],
    },
    {
      heading: 'What we never do',
      points: [
        'No advertising to your child, and no advertising profiles.',
        'We never sell your child\'s data.',
        'We do not use your child\'s session content to train our own AI.',
      ],
    },
    {
      heading: 'Giving your consent',
      body:
        'To confirm you are an adult giving consent, we run a small card check through our payment processor, Stripe. It uses your bank\'s security step and does not charge you anything. We keep a record that consent was given.',
    },
    {
      heading: 'Your rights, any time',
      body:
        `You can review what we hold about your child, ask us to delete it, and withdraw your consent, which switches the live tutor back off. Just email ${PRIVACY_CONTACT} and a real person will help. The full detail is in our Privacy Policy.`,
    },
  ],
  closing:
    'By continuing, you confirm you are the parent or guardian, you agree to our Terms on your child\'s behalf, and you consent to Ohmlet\'s live tutor for your child as described here and in our Privacy Policy.',
};

export interface ChildNotice {
  title: string;
  lines: string[];
  cta: string;
}

// Shown to the child once, after consent, before their first build. Short,
// warm, plain words. Same facts as the parent notice, told to the kid.
export const CHILD_NOTICE: ChildNotice = {
  title: "Hi, I'm Ohmlet",
  lines: [
    "I'm a computer helper, not a real person, and I'm here to help you build cool electronics.",
    "A grown-up you know said it's okay for us to work together.",
    'When you turn the camera on, point it at your breadboard and parts, not at you.',
    "I'll never ask your name, where you live, or your school. You don't need to tell me any of that.",
    'If something ever feels wrong, or a part gets hot or smells funny, stop and get a grown-up.',
    'You can stop any time you like.',
  ],
  cta: "Got it, let's build",
};
