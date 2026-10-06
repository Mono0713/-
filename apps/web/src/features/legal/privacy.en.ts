import type { LegalDoc } from './types'

/** Privacy policy, English. The Traditional Chinese version prevails. */
export const privacyEn: LegalDoc = {
  title: 'Privacy Policy',
  operator: 'the {brand} team',
  intro:
    '{brand} ("we") treats your exams and study records as yours. This policy explains in plain words what we collect, why, where it is stored, who receives it, and how you can see, download or delete it.',
  sections: [
    {
      title: 'Who is responsible for your data',
      body: ['This site is run by {operator}, who collects and controls your personal data. For any question about this policy or your data, write to {email}.'],
    },
    {
      title: 'What we collect',
      body: [
        [
          'Account data: the name, email address and profile picture from your Google sign-in, and any name or picture you change on the site. We never see your Google password.',
          'Your content: exams, handouts, photos and PDFs you upload, and the questions, figures, answers (including handwriting), grades and AI conversations made from them.',
          'API keys: the AI service keys you paste, encrypted with AES-256-GCM before they are stored; the site only shows their last characters.',
          'Classes and sharing: classes you create or join, work you hand in, and share links you create.',
          'Usage records: the service, model and amount of text of each AI call (not its content), to show your costs and pick suitable models.',
          'Technical data: to keep the site running and protect it from attacks, the host briefly keeps IP addresses, browser types and error logs.',
        ],
        'We never ask for ID numbers, addresses, phone numbers or payment details. Please do not upload other people’s sensitive personal data in exams or answers.',
      ],
    },
    {
      title: 'Why we collect it',
      body: [
        'Only to provide and improve {brand}: your account, reading exams, the question bank, quizzes and grading, sharing and classes, usage display, and keeping the site secure. Under the EU GDPR, our legal basis is performing our contract with you, and our legitimate interest in keeping the service secure.',
        'We do not sell your data, do not use your content to train AI models, and do not use it for personalised advertising.',
      ],
    },
    {
      title: 'How AI services handle your content',
      body: [
        'When reading, grading, translating or asking AI, the relevant page images, questions and answers are sent with your own key directly to the AI service you chose (for example Anthropic, OpenAI, Google, or a custom service). That service’s terms and privacy policy then apply; most say they do not train on data sent through their API, but check each service’s current statement.',
        'With free translation, question text is sent to Google Translate (or MyMemory if that fails), without your account details.',
        'To save cost and time, translations and grading results are cached by a hash of their content, without recording whose content it was.',
        'If we later offer “share anonymous samples” to improve recognition, it will be off by default and used only if you turn it on.',
      ],
    },
    {
      title: 'Who can see your data',
      body: [
        [
          'By default, only you.',
          'Share links: anyone signed in who has the link can see that exam; you can turn the link off at any time.',
          'Classes: teachers and the assistants they choose see students’ names, pictures, handed-in work and scores; classmates may see each other’s names, but not each other’s answers.',
          'Service providers that help us run the site, only as needed to provide it: Supabase (database and sign-in, Singapore), Cloudflare (R2 file storage), our web host, and the AI services you choose.',
          'When the law requires it, through due legal process.',
        ],
      ],
    },
    {
      title: 'Where data is stored and for how long',
      body: [
        'The database is in Singapore; files are stored on Cloudflare’s global network; AI services may process what you send in the United States or elsewhere. By using the service you understand that your data may be processed outside your country; we only use providers with reasonable safeguards.',
        [
          'We keep your data while your account exists, until you delete it or the account.',
          'Uploaded original files are deleted 30 days after the exam is saved to your bank, unless you choose to keep them; compressed page images stay with the exam.',
          'When you delete your account, your data is deleted from the database and file storage at once; providers’ backups expire within their backup cycle (usually 30 days).',
          'Host technical logs are usually rotated within 30 days.',
        ],
      ],
    },
    {
      title: 'Cookies and browser storage',
      body: [
        'We only use cookies the site needs to work: your sign-in, and your interface language before you sign in. Theme, sidebar and layout choices stay in your own browser. We use no advertising or third-party tracking cookies; if we ever add ads or analytics, we will ask for your consent first.',
      ],
    },
    {
      title: 'Your rights',
      body: [
        'You may ask to access your personal data, receive a copy, correct or complete it, stop its collection, processing or use, and have it deleted (Taiwan Personal Data Protection Act, Article 3). In the EU or UK you also have the GDPR rights to data portability and to object, and may complain to your local supervisory authority.',
        [
          'In Settings → Account and data you can download all your data (a JSON file) or delete your account at any time.',
          'You can change your name and picture in Settings, and delete exams, questions and quizzes at any time.',
          'For anything else, write to {email}. We answer access and copy requests within 15 days and correction or deletion within 30 days; if we need longer, we will tell you why.',
        ],
        'You may choose not to give us data, but without an account you cannot use the bank, quizzes, sharing or classes.',
      ],
    },
    {
      title: 'Children and minors',
      body: [
        'Children under 13 should use the service only with a parent or guardian’s consent and supervision. Users under 18 should have a parent or guardian read and agree to this policy and the terms first.',
        'Teachers using classes should obtain any consent their school requires from students or parents, and upload only what teaching needs. If you find a child gave us data without consent, contact us and we will delete it.',
      ],
    },
    {
      title: 'How we protect data',
      body: [
        [
          'The whole site uses HTTPS and sends security headers against clickjacking and content sniffing.',
          'API keys are stored encrypted and decrypted on the server only when an AI request is sent; they never go back to the browser.',
          'Row Level Security is on in the database, so the public sign-in key cannot read or change any data directly; every access checks that the data is yours.',
          'Images are served through signed links that expire within minutes.',
        ],
        'No system is perfectly secure. If an incident may affect your personal data, we will tell you as soon as we have established the facts, what happened and what we are doing about it.',
      ],
    },
    {
      title: 'Changes to this policy',
      body: ['We may update this policy when features or laws change, and will change the date at the top. For significant changes, such as a new use of your data, we will tell you on the site or by email in advance.'],
    },
  ],
}
