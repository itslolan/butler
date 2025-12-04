'use client';

import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';

export default function LandingPage() {
  const { loading } = useAuth();

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 text-slate-900 dark:text-white selection:bg-blue-100 dark:selection:bg-blue-900/30">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 dark:bg-gray-950/80 backdrop-blur-md border-b border-slate-100 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold shadow-sm">
              A
            </div>
            <span className="font-semibold text-lg tracking-tight">Adphex</span>
          </div>
          
          <div className="flex items-center gap-4">
            <Link 
              href="/login"
              className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              Sign In
            </Link>
            <Link 
              href="/login"
              className="px-4 py-2 text-sm font-medium text-white bg-slate-900 dark:bg-white dark:text-slate-900 rounded-full hover:bg-slate-800 dark:hover:bg-slate-100 transition-all shadow-sm hover:shadow-md"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs font-medium border border-blue-100 dark:border-blue-800">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            Powerful duplicate transaction detection
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-slate-900 dark:text-white leading-[1.1]">
            ChatGPT for your <br />
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">finances.</span>
          </h1>
          
          <div className="max-w-2xl mx-auto space-y-4">
            <p className="text-xl text-slate-600 dark:text-slate-400 leading-relaxed">
              Get trusted answers about your finances. Save more money and get richer with personalized financial advice.
            </p>
            <p className="text-lg text-slate-500 dark:text-slate-500">
              Just upload your bank statements, and we&apos;ll take care of the rest.
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <div className="flex flex-col items-center">
              <Link 
                href="/demo"
                className="w-full sm:w-auto px-8 py-4 bg-blue-600 dark:bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-700 dark:hover:bg-blue-600 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                Try it out
              </Link>
              <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">No signup required</span>
            </div>
            <Link 
              href="/login"
              className="w-full sm:w-auto px-8 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-semibold hover:bg-slate-800 dark:hover:bg-slate-100 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              Start Analyzing Free
            </Link>
          </div>
        </div>
      </section>

      {/* Why not just use ChatGPT? */}
      <section className="py-24 px-6 bg-slate-50/50 dark:bg-gray-900/50 border-y border-slate-100 dark:border-slate-800">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-6">Why not just use ChatGPT?</h2>
          </div>

          <div className="space-y-12">
            <div className="flex gap-6 items-start">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 mt-1">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Advanced Duplicate Detection</h3>
                    <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed">
                        Adphex does advanced duplicate detection so that you don&apos;t have to worry about whether you uploaded your document twice or more times.
                    </p>
                </div>
            </div>

            <div className="flex gap-6 items-start">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mt-1">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>
                </div>
                <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Interactive Metrics</h3>
                    <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed">
                        Adphex allows you to track important metrics using interactive graphs and diagrams, allowing you to &quot;just glance&quot; to understand their financial health.
                    </p>
                </div>
            </div>

            <div className="flex gap-6 items-start">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400 mt-1">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Historic Financial Data</h3>
                    <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed">
                        Adphex allows the user to ask any financial question and get answers based on years of historic financial data.
                    </p>
                </div>
            </div>

             <div className="flex gap-6 items-start">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400 mt-1">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </div>
                <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Personalized Tips</h3>
                    <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed">
                        Adphex gives personalized tips on saving more money and improving financial health.
                    </p>
                </div>
            </div>

             <div className="flex gap-6 items-start">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center text-yellow-600 dark:text-yellow-400 mt-1">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                </div>
                <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Your Personal Butler</h3>
                    <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed">
                        Adphex is your own personal butler who handles all your money for you.
                    </p>
                </div>
            </div>

          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 bg-white dark:bg-gray-900">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">Everything you need to understand your cashflow</h2>
            <p className="text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
              Stop manually tagging transactions. Adphex automates the tedious parts of personal finance.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, i) => (
              <div key={i} className="bg-slate-50 dark:bg-gray-950 p-8 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-blue-100 dark:hover:border-blue-900/30 hover:shadow-lg transition-all group">
                <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400 mb-6 group-hover:scale-110 transition-transform duration-300">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">{feature.title}</h3>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-sm">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 px-6 border-t border-slate-100 dark:border-slate-800">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-12 text-center">From PDF to Insights in Seconds</h2>
          
          <div className="space-y-12">
            {steps.map((step, i) => (
              <div key={i} className="flex gap-6 md:gap-8 items-start">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-600 dark:text-slate-400 mt-1">
                  {i + 1}
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold text-slate-900 dark:text-white">{step.title}</h3>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-32 px-6 bg-slate-900 dark:bg-blue-950 text-white text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-800/30 via-slate-900/0 to-slate-900/0 pointer-events-none"></div>
        <div className="relative max-w-3xl mx-auto space-y-8">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight">Ready to take control?</h2>
          <p className="text-xl text-slate-300 max-w-xl mx-auto">
            Join thousands who have ditched their spreadsheets for Adphex&apos;s AI insights.
          </p>
          <Link 
            href="/login"
            className="inline-block px-8 py-4 bg-white text-slate-900 rounded-xl font-bold hover:bg-blue-50 transition-colors shadow-xl"
          >
            Get Started Now
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-gray-950">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6 text-sm text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-slate-200 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-700 dark:text-slate-300 text-xs">A</div>
            <span>© 2025 Adphex. All rights reserved.</span>
          </div>
          <div className="flex gap-8">
            <a href="#" className="hover:text-slate-900 dark:hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-slate-900 dark:hover:text-white transition-colors">Terms</a>
            <a href="#" className="hover:text-slate-900 dark:hover:text-white transition-colors">Twitter</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

const features = [
  {
    title: 'Bank Statement Analysis',
    description: 'Upload PDFs or images. Adphex parses messy layouts and extracts clean, structured transaction data instantly.',
    icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 011.414.586l4 4a1 1 0 01.586 1.414V19a2 2 0 01-2 2z" /></svg>
  },
  {
    title: 'Smart Categorization',
    description: 'Transactions are automatically tagged as Income, Expense, or Transfers. No more manual sorting.',
    icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
  },
  {
    title: 'Duplicate Detection',
    description: 'Our advanced algorithms ensure no duplicate transactions are logged, even if you make mistakes saving them, Adphex is smart enough to take care of everything.',
    icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
  },
];

const steps = [
  {
    title: 'Upload Your Statement',
    description: 'Drag and drop your PDF bank statements or take screenshots of your mobile banking app.',
  },
  {
    title: 'AI Processing',
    description: 'Adphex scans the document, extracting dates, merchants, and amounts while identifying account details.',
  },
  {
    title: 'Ask Questions',
    description: 'Chat with your data. "How much did I spend on coffee last month?" or "What is my net worth trend?"',
  },
];
