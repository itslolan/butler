'use client';

import Link from 'next/link';

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-slate-900 dark:to-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-4">
            Privacy Policy
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>

        {/* Content */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-8 md:p-12 space-y-8">
          {/* Introduction */}
          <section>
          <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
            Adphex (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our financial management application.
          </p>
          </section>

          {/* Information We Collect */}
          <section>
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-4">
              1. Information We Collect
            </h2>
            
            <h3 className="text-xl font-medium text-slate-800 dark:text-slate-200 mb-3 mt-6">
              1.1 Information You Provide
            </h3>
            <ul className="list-disc list-inside space-y-2 text-slate-700 dark:text-slate-300 ml-4">
              <li>Account information (email address, name)</li>
              <li>Financial data you manually enter (income, budgets, categories)</li>
              <li>Bank statements and transaction data you upload</li>
              <li>Communication preferences and settings</li>
            </ul>

            <h3 className="text-xl font-medium text-slate-800 dark:text-slate-200 mb-3 mt-6">
              1.2 Information from Third-Party Services
            </h3>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
              When you connect your bank accounts through Plaid:
            </p>
            <ul className="list-disc list-inside space-y-2 text-slate-700 dark:text-slate-300 ml-4">
              <li>Account balances and transaction history</li>
              <li>Account and routing numbers</li>
              <li>Account holder names and contact information</li>
              <li>Institution names and account types</li>
            </ul>

            <h3 className="text-xl font-medium text-slate-800 dark:text-slate-200 mb-3 mt-6">
              1.3 Automatically Collected Information
            </h3>
            <ul className="list-disc list-inside space-y-2 text-slate-700 dark:text-slate-300 ml-4">
              <li>Device information (browser type, operating system)</li>
              <li>Usage data (features used, time spent in app)</li>
              <li>Log data (IP address, access times, pages viewed)</li>
            </ul>
          </section>

          {/* How We Use Your Information */}
          <section>
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-4">
              2. How We Use Your Information
            </h2>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
              We use your information to:
            </p>
            <ul className="list-disc list-inside space-y-2 text-slate-700 dark:text-slate-300 ml-4">
              <li>Provide and maintain our financial management services</li>
              <li>Process and categorize your transactions</li>
              <li>Generate budget insights and recommendations using AI</li>
              <li>Sync your bank account data through Plaid</li>
              <li>Improve and personalize your experience</li>
              <li>Send you important notifications and updates</li>
              <li>Detect and prevent fraud or unauthorized access</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          {/* AI and Data Processing */}
          <section>
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-4">
              3. AI-Powered Features
            </h2>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
              We use artificial intelligence to analyze your financial data and provide personalized insights, recommendations, and automated categorization. Your financial data may be processed by third-party AI services (such as Google&apos;s Gemini) to power these features. We do not use your data to train AI models, and all processing is done in accordance with strict confidentiality standards.
            </p>
          </section>

          {/* Data Sharing */}
          <section>
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-4">
              4. How We Share Your Information
            </h2>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
              We may share your information with:
            </p>
            <ul className="list-disc list-inside space-y-2 text-slate-700 dark:text-slate-300 ml-4">
              <li><strong>Service Providers:</strong> Third-party companies that help us operate our service (e.g., Plaid for banking connections, Supabase for data storage, AI services for insights)</li>
              <li><strong>Legal Requirements:</strong> When required by law, regulation, or legal process</li>
              <li><strong>Business Transfers:</strong> In connection with a merger, sale, or acquisition of all or a portion of our business</li>
              <li><strong>With Your Consent:</strong> When you explicitly authorize us to share your information</li>
            </ul>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed mt-4">
              <strong>We do not sell your personal financial data to third parties.</strong>
            </p>
          </section>

          {/* Data Security */}
          <section>
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-4">
              5. Data Security
            </h2>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
              We implement industry-standard security measures to protect your information:
            </p>
            <ul className="list-disc list-inside space-y-2 text-slate-700 dark:text-slate-300 ml-4">
              <li>Encryption of data in transit and at rest</li>
              <li>Secure authentication and access controls</li>
              <li>Regular security audits and monitoring</li>
              <li>Compliance with banking data security standards</li>
            </ul>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed mt-4">
              However, no method of transmission over the Internet is 100% secure. While we strive to protect your information, we cannot guarantee absolute security.
            </p>
          </section>

          {/* Third-Party Services */}
          <section>
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-4">
              6. Third-Party Services
            </h2>
            <h3 className="text-xl font-medium text-slate-800 dark:text-slate-200 mb-3">
              6.1 Plaid
            </h3>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
              We use Plaid to connect to your bank accounts. Plaid&apos;s services are governed by their own Privacy Policy. When you connect your accounts, you authorize Plaid to access and share your financial data with us. Learn more at{' '}
              <a href="https://plaid.com/legal" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                plaid.com/legal
              </a>.
            </p>

            <h3 className="text-xl font-medium text-slate-800 dark:text-slate-200 mb-3">
              6.2 Supabase
            </h3>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
              We use Supabase for secure data storage and authentication. Your data is stored in compliance with industry security standards.
            </p>
          </section>

          {/* Data Retention */}
          <section>
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-4">
              7. Data Retention
            </h2>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
              We retain your information for as long as your account is active or as needed to provide you services. You may request deletion of your account and data at any time. Following deletion, we will remove or anonymize your personal information, except where we are required to retain it by law.
            </p>
          </section>

          {/* Your Rights */}
          <section>
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-4">
              8. Your Rights and Choices
            </h2>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
              You have the right to:
            </p>
            <ul className="list-disc list-inside space-y-2 text-slate-700 dark:text-slate-300 ml-4">
              <li>Access and review your personal information</li>
              <li>Correct inaccurate or incomplete data</li>
              <li>Request deletion of your account and data</li>
              <li>Export your financial data</li>
              <li>Disconnect bank accounts at any time</li>
              <li>Opt-out of non-essential communications</li>
              <li>Withdraw consent for data processing where applicable</li>
            </ul>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed mt-4">
              To exercise these rights, please contact us using the information provided below.
            </p>
          </section>

          {/* Children's Privacy */}
          <section>
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-4">
              9. Children&apos;s Privacy
            </h2>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
              Our service is not intended for individuals under the age of 18. We do not knowingly collect personal information from children. If you believe we have collected information from a child, please contact us immediately.
            </p>
          </section>

          {/* International Users */}
          <section>
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-4">
              10. International Users
            </h2>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
              If you are accessing our service from outside the United States, please be aware that your information may be transferred to, stored, and processed in the United States or other countries where our service providers operate. By using our service, you consent to this transfer.
            </p>
          </section>

          {/* Changes to Privacy Policy */}
          <section>
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-4">
              11. Changes to This Privacy Policy
            </h2>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the &quot;Last updated&quot; date. We encourage you to review this Privacy Policy periodically for any changes.
            </p>
          </section>

          {/* Contact Information */}
          <section>
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-4">
              12. Contact Us
            </h2>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
              If you have any questions about this Privacy Policy or our data practices, please contact us at:
            </p>
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
              <p className="text-slate-700 dark:text-slate-300">
                <strong>Email:</strong>{' '}
                <a href="mailto:privacy@adphex.com" className="text-blue-600 dark:text-blue-400 hover:underline">
                  privacy@adphex.com
                </a>
              </p>
            </div>
          </section>

          {/* Consent */}
          <section className="border-t border-slate-200 dark:border-slate-700 pt-8">
            <p className="text-slate-600 dark:text-slate-400 italic leading-relaxed">
              By using Adphex, you acknowledge that you have read, understood, and agree to be bound by this Privacy Policy.
            </p>
          </section>
        </div>

        {/* Back to Home */}
        <div className="text-center mt-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

