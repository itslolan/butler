'use client';

import Link from 'next/link';
import Head from 'next/head';

export default function SimpleLandingPage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Adphex",
    "applicationCategory": "FinanceApplication",
    "description": "Upload bank statements or screenshot your transactions with our Chrome extension. Adphex uses AI to surface deep insights about your spending, subscriptions, and financial patterns.",
    "url": "https://adphex.com",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    },
    "featureList": [
      "Bank statement analysis with AI",
      "Chrome extension for transaction screenshots",
      "Deep spending pattern insights",
      "Subscription and fixed expense detection",
      "Chat with your financial data"
    ]
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 text-slate-900 dark:text-white selection:bg-blue-100 dark:selection:bg-blue-900/30">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 dark:bg-gray-950/80 backdrop-blur-md border-b border-slate-100 dark:border-slate-800">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white text-sm font-bold">
              A
            </div>
            <span className="font-semibold text-base tracking-tight">Adphex</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="px-3.5 py-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-28 pb-16 px-6">
        <div className="max-w-2xl mx-auto">
          <p className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-4 tracking-wide">
            Built by geeks who wanted to understand their own money
          </p>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight leading-snug mb-5">
            Finally understand what&apos;s happening in your bank account
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed mb-8 max-w-xl">
            Drop in your bank statements or screenshot your transactions with our Chrome extension.
            Adphex&apos;s AI digs through every line and surfaces the insights you&apos;d never find on your own &mdash; hidden subscriptions, spending trends, and where your money actually goes.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/signup"
              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm"
            >
              Start for free
            </Link>
            <Link
              href="/demo"
              className="px-5 py-2.5 bg-white dark:bg-gray-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Try the demo
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 px-6 border-t border-slate-100 dark:border-slate-800" aria-label="How Adphex works">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold mb-8">How it works</h2>
          <ol className="space-y-8">
            <li className="flex gap-4">
              <span className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold">
                1
              </span>
              <div>
                <h3 className="font-semibold text-lg mb-1">Bring your data however you want</h3>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  Upload a PDF bank statement, drag in a CSV export, or use our
                  <strong> Chrome extension</strong> to screenshot transactions straight from your banking app. We handle the rest.
                </p>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold">
                2
              </span>
              <div>
                <h3 className="font-semibold text-lg mb-1">AI reads every transaction</h3>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  Adphex categorizes, de-duplicates, and structures your data automatically. It catches overlapping date ranges, flags recurring charges, and maps out your fixed expenses.
                </p>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold">
                3
              </span>
              <div>
                <h3 className="font-semibold text-lg mb-1">Ask questions, get real answers</h3>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  &ldquo;How much did I spend eating out last month?&rdquo; &ldquo;What subscriptions am I paying for?&rdquo;
                  Chat with your financial data in plain English and get charts, breakdowns, and insights instantly.
                </p>
              </div>
            </li>
          </ol>
        </div>
      </section>

      {/* Chrome Extension callout */}
      <section className="py-16 px-6 bg-slate-50 dark:bg-gray-900/50 border-t border-slate-100 dark:border-slate-800" aria-label="Chrome extension">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-start gap-5">
            <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-sm">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-2">Screenshot your transactions in one click</h2>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
                Our Chrome extension sits right in your browser. Log into your bank, highlight your transactions, and hit capture.
                Adphex extracts every line item from the screenshot &mdash; no downloads, no CSV exports, no copy-pasting into spreadsheets.
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-500">
                Works with any bank that shows transactions in a browser. Just screenshot and go.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Deep insights */}
      <section className="py-16 px-6 border-t border-slate-100 dark:border-slate-800" aria-label="Financial insights from bank statement analysis">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold mb-3">Insights you can&apos;t get from staring at a spreadsheet</h2>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-8">
            We built Adphex because we were tired of exporting CSVs and pivot-tabling our lives away.
            The AI doesn&apos;t just organize your data &mdash; it actually finds things.
          </p>
          <div className="grid sm:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <h3 className="font-semibold">Hidden subscriptions</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Spots recurring charges you forgot about &mdash; that gym, the trial you never cancelled.
              </p>
            </div>
            <div className="space-y-1.5">
              <h3 className="font-semibold">Spending trends over time</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                See how your groceries, dining, or travel spending shifted month over month.
              </p>
            </div>
            <div className="space-y-1.5">
              <h3 className="font-semibold">Fixed vs. variable costs</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Know exactly what&apos;s non-negotiable each month so you can plan around it.
              </p>
            </div>
            <div className="space-y-1.5">
              <h3 className="font-semibold">Category breakdowns</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                AI-powered categorization that actually makes sense, not the nonsense your bank gives you.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-6 bg-slate-900 dark:bg-slate-900 text-white border-t border-slate-800" aria-label="Get started">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-3">Stop guessing. Start knowing.</h2>
          <p className="text-slate-400 mb-6 max-w-lg mx-auto">
            Upload your first bank statement and see what Adphex finds. It&apos;s free to start and takes about 30 seconds.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/signup"
              className="px-5 py-2.5 bg-white text-slate-900 rounded-lg font-medium hover:bg-slate-100 transition-colors"
            >
              Get started free
            </Link>
            <Link
              href="/demo"
              className="px-5 py-2.5 border border-slate-600 text-slate-300 rounded-lg font-medium hover:bg-slate-800 transition-colors"
            >
              View demo
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-50 dark:bg-gray-900 border-t border-slate-100 dark:border-slate-800">
        <div className="max-w-2xl mx-auto px-6 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white text-[10px] font-bold">
                A
              </div>
              <span>Adphex</span>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/blog" className="hover:text-slate-900 dark:hover:text-white transition-colors">Blog</Link>
              <Link href="/tools" className="hover:text-slate-900 dark:hover:text-white transition-colors">Tools</Link>
              <Link href="/pricing" className="hover:text-slate-900 dark:hover:text-white transition-colors">Pricing</Link>
              <Link href="/privacy" className="hover:text-slate-900 dark:hover:text-white transition-colors">Privacy</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
