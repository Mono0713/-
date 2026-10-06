import type { LegalDoc } from './types'

/** Terms of service, English. The Traditional Chinese version prevails. */
export const termsEn: LegalDoc = {
  title: 'Terms of Service',
  operator: 'the {brand} team',
  intro:
    'Welcome to {brand}. These terms are the agreement between you and {operator} about using this site. By signing in or using the service you confirm that you have read and agree to these terms and the privacy policy; if you do not agree, please do not use it.',
  sections: [
    {
      title: '1. The service',
      body: ['{brand} turns exams, handouts and workbooks into an editable question bank with practice, quizzes, AI grading, sharing and classes. The service is in a testing phase: features may change, and it may sometimes make mistakes or be unavailable.'],
    },
    {
      title: '2. Your account',
      body: [['You sign in with a Google account and are responsible for what happens in your account. Accounts are personal; do not share yours.', 'If you think your account has been misused, tell us right away.']],
    },
    {
      title: '3. Age and minors',
      body: ['Children under 13 may use the service only with a parent or guardian’s consent and supervision. Users under 18 need a parent or guardian to read and agree to these terms first. Teachers using classes must make sure any consent their school requires has been obtained.'],
    },
    {
      title: '4. Your API keys and costs',
      body: [
        [
          'AI features use API keys you obtain yourself, and AI providers bill you directly. Costs shown on the site are estimates from public prices; your provider’s bill is what counts.',
          'Keep your keys safe and set spending limits with your provider. If a key leaks or is misused, we will help find out what happened, but we are not liable for the charges unless they result from our intent or gross negligence.',
          'When a teacher chooses to pay for a class’s AI, students’ work is graded with the teacher’s key.',
        ],
      ],
    },
    {
      title: '5. Your content and copyright',
      body: [
        [
          'Content you upload or create remains yours or its original owner’s. To provide the service, you let us store, copy, convert, display and send it to the AI services you choose, as far as needed; this permission ends when you delete the content or your account (except copies already shared with others).',
          'Exams and handouts are often the work of schools, teachers or publishers. Copying them for your own non-commercial study is usually fair use, but sharing them publicly or commercially may infringe copyright. Make sure you have the right before uploading or sharing; whoever shares is responsible for it.',
          'Do not upload illegal content, other people’s personal data without their consent, or anything that infringes others’ rights.',
        ],
      ],
    },
    {
      title: '6. Copyright complaints',
      body: ['If you believe content on this site infringes your copyright or other rights, write to {email} with your contact details, the work concerned, the link or location of the content, and a statement that you believe its use is not authorised. Once we have a complete notice we will remove or stop sharing the content promptly and tell the uploader, who may respond if they think it is a mistake. Accounts that repeatedly infringe will be closed.'],
    },
    {
      title: '7. What you may not do',
      body: [
        [
          'Attack, break into or disrupt the site, or try to reach data that is not yours.',
          'Scrape the site in bulk, or get around usage or access limits.',
          'Upload malware or spam, or pretend to be someone else.',
          'Use the service to cheat in real exams, or for anything else illegal.',
        ],
        'If you do, we may remove the content, suspend or close your account, and cooperate with investigations where the law requires.',
      ],
    },
    {
      title: '8. AI-generated content',
      body: ['AI reading, grading, translation and explanations can be wrong. They are for study only and do not replace a teacher’s judgment or official grades. Check important answers and scores yourself.'],
    },
    {
      title: '9. Paid plans',
      body: ['The service is currently free (you pay for AI yourself, see section 4). If we introduce subscriptions or other paid plans, their prices, payment, renewal and refund rules will be shown clearly before you buy, in line with consumer protection law.'],
    },
    {
      title: '10. Changes and ending the service',
      body: [
        [
          'You can download your data and delete your account at any time in Settings → Account and data.',
          'We may change or stop some features. If we shut down the whole service, we will tell you on the site or by email at least 30 days in advance so you can download your data.',
          'If you break these terms we may suspend or close your account; for minor issues we will ask you to fix them first.',
        ],
      ],
    },
    {
      title: '11. Disclaimer and limitation of liability',
      body: ['The service is provided as is. As far as the law allows, we do not promise it will be uninterrupted or error-free, and we are not liable for indirect losses from using or being unable to use it. This does not limit liability for our intent or gross negligence, or any liability the law does not allow us to exclude.'],
    },
    {
      title: '12. Governing law and courts',
      body: ['These terms are governed by the laws of the Republic of China (Taiwan). Disputes go first to the Taiwan Taipei District Court, unless consumer protection or other mandatory law says otherwise.'],
    },
    {
      title: '13. Changes to these terms and contact',
      body: ['We may change these terms and will update the date at the top; significant changes will be announced in advance. Continuing to use the service after a change means you accept the new terms. Questions go to {email}. Where versions in different languages differ, the Traditional Chinese version prevails.'],
    },
  ],
}
