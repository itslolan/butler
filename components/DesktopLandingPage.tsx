'use client';

import Link from 'next/link';

const DMG_DOWNLOAD_URL = '#'; // TODO: replace with actual DMG download URL

export default function DesktopLandingPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-black text-slate-900 dark:text-white selection:bg-blue-100 dark:selection:bg-blue-900/30 font-sans">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 dark:bg-black/80 backdrop-blur-xl border-b border-slate-100 dark:border-slate-900">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-black dark:bg-white flex items-center justify-center text-white dark:text-black font-bold">
              A
            </div>
            <span className="font-semibold text-lg tracking-tight">Adphex</span>
          </div>
          <div className="flex items-center gap-6">
            <Link
              href="?variant=old"
              className="text-sm font-medium text-slate-500 hover:text-black dark:hover:text-white transition-colors"
            >
              Web App
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-40 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter leading-[1.1]">
            Automated financial analysis.
            <br />
            <span className="text-slate-400 dark:text-slate-500">On your Mac.</span>
          </h1>

          <p className="text-xl md:text-2xl text-slate-500 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed tracking-tight">
            Drop in your bank statements. Adphex categorizes transactions, detects duplicates, and answers your questions using on-device AI.
          </p>

          <div className="pt-8 flex flex-col items-center gap-4">
            <a
              href={DMG_DOWNLOAD_URL}
              className="inline-flex items-center gap-3 px-8 py-4 bg-black dark:bg-white text-white dark:text-black rounded-full font-medium text-lg hover:scale-105 transition-transform duration-200"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
              </svg>
              Download for macOS
            </a>
            <p className="text-sm text-slate-400">
              macOS 13+ &middot; Apple Silicon &amp; Intel
            </p>
          </div>
        </div>
      </section>

      {/* Terminal Mockup */}
      <section className="px-6 pb-32">
        <div className="max-w-3xl mx-auto">
          <div className="bg-[#fafafa] dark:bg-[#111] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 md:p-8 font-mono text-sm md:text-base text-left shadow-2xl overflow-hidden">
            <div className="flex gap-2 mb-6">
              <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
              <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
            </div>
            <div className="space-y-4 text-slate-600 dark:text-slate-300">
              <p><span className="text-blue-500 font-bold">❯</span> adphex analyze statement_october.pdf</p>
              <p className="text-slate-400">Processing locally...</p>
              <p className="text-emerald-600 dark:text-emerald-400">✓ Extracted 142 transactions</p>
              <p className="text-emerald-600 dark:text-emerald-400">✓ Categorized expenses</p>
              <p className="text-emerald-600 dark:text-emerald-400">✓ Found 2 recurring subscriptions</p>
              <br />
              <p><span className="text-blue-500 font-bold">❯</span> adphex ask &quot;How much did I spend on dining out last month?&quot;</p>
              <p className="text-slate-900 dark:text-white mt-2">
                ✦ You spent $452.50 on dining out in October. Your largest expense was $120.00 at The French Laundry.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 px-6 bg-[#fafafa] dark:bg-[#0a0a0a] border-y border-slate-100 dark:border-slate-900">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-12 md:gap-8">
            {[
              {
                title: '100% Private',
                desc: 'Powered by on-device LLMs (Qwen & GLM). Your financial data never leaves your Mac. No cloud, no API calls, no telemetry.',
                icon: (
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                ),
              },
              {
                title: 'Automated Analysis',
                desc: 'Drop in PDFs or screenshots. Adphex automatically extracts transactions, detects duplicates, and categorizes your spending.',
                icon: (
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                  </svg>
                ),
              },
              {
                title: 'Chat with your finances',
                desc: 'Ask natural language questions about your spending habits, budgets, and trends. Get instant, accurate answers from your own data.',
                icon: (
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                  </svg>
                ),
              },
            ].map((feature) => (
              <div key={feature.title} className="space-y-4">
                <div className="text-black dark:text-white">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold tracking-tight">{feature.title}</h3>
                <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white dark:bg-black py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400">
              &copy; {new Date().getFullYear()} Adphex
            </span>
          </div>
          <div className="flex items-center gap-6 text-sm text-slate-400">
            <Link href="/privacy" className="hover:text-black dark:hover:text-white transition-colors">
              Privacy
            </Link>
            <Link href="?variant=old" className="hover:text-black dark:hover:text-white transition-colors">
              Web App
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
