'use client';

import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';

export default function LandingPage() {
  const { loading } = useAuth();

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Adphex",
    "applicationCategory": "FinanceApplication",
    "description": "AI-powered financial assistant that helps you track expenses, analyze bank statements, and get personalized financial insights.",
    "url": "https://adphex.com",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.8",
      "ratingCount": "150"
    },
    "featureList": [
      "Bank statement analysis",
      "AI-powered expense tracking",
      "Duplicate transaction detection",
      "Financial insights and recommendations",
      "Interactive charts and visualizations"
    ]
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 text-slate-900 dark:text-white selection:bg-blue-100 dark:selection:bg-blue-900/30">
      {/* Structured Data for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
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
              Get trusted answers about your finances. Save more money and get richer with personalized AI-powered advice.
            </p>
            <p className="text-lg text-slate-500 dark:text-slate-500">
              Just upload your bank statements, and we&apos;ll take care of the rest.
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-center gap-4 pt-4">
            <div className="flex flex-col items-center">
              <Link 
                href="/demo"
                className="w-full sm:w-auto px-8 py-4 bg-blue-600 dark:bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-700 dark:hover:bg-blue-600 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                Try it out
              </Link>
              <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">No signup required</span>
            </div>
            <div className="flex flex-col items-center">
              <Link 
                href="/signup"
                className="w-full sm:w-auto px-8 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-semibold hover:bg-slate-800 dark:hover:bg-slate-100 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                Signup for Free
              </Link>
              <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 h-4"></span>
            </div>
          </div>
        </div>
      </section>

      {/* Why not just use ChatGPT? */}
      <section className="py-24 px-6 bg-slate-50/50 dark:bg-gray-900/50 border-y border-slate-100 dark:border-slate-800" aria-label="Why choose Adphex">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-6">Why not just use ChatGPT?</h2>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              While ChatGPT is great for general questions, Adphex is specifically designed for personal finance management. We offer specialized features that make tracking your money effortless and accurate.
            </p>
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
      <section id="features" className="py-24 bg-white dark:bg-gray-900" aria-label="Features">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">Everything you need to understand your cashflow</h2>
            <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              Stop manually tagging transactions. Adphex automates the tedious parts of personal finance management. Our intelligent system handles document parsing, transaction categorization, duplicate detection, and provides real-time insights into your spending habits. Whether you&apos;re managing personal finances or tracking business expenses, Adphex gives you the tools to stay on top of your money.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, i) => (
              <article key={i} className="bg-slate-50 dark:bg-gray-950 p-8 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-blue-100 dark:hover:border-blue-900/30 hover:shadow-lg transition-all group">
                <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400 mb-6 group-hover:scale-110 transition-transform duration-300" aria-hidden="true">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">{feature.title}</h3>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-sm">
                  {feature.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 px-6 border-t border-slate-100 dark:border-slate-800" aria-label="How it works">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4 text-center">From PDF to Insights in Seconds</h2>
          <p className="text-lg text-slate-600 dark:text-slate-400 text-center mb-12 max-w-2xl mx-auto">
            Getting started with Adphex is simple. Our three-step process transforms your raw financial documents into actionable insights that help you understand and improve your financial health.
          </p>
          
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
      <section className="py-32 px-6 bg-slate-900 dark:bg-blue-950 text-white text-center relative overflow-hidden" aria-label="Call to action">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-800/30 via-slate-900/0 to-slate-900/0 pointer-events-none" aria-hidden="true"></div>
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
      <footer className="bg-slate-50 dark:bg-gray-900 border-t border-slate-100 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            {/* Brand */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold shadow-sm">
                  A
                </div>
                <span className="font-semibold text-slate-900 dark:text-white">Adphex</span>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Your AI-powered financial assistant for smarter money management.
              </p>
            </div>

            {/* Product */}
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Product</h3>
              <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
                <li><Link href="/demo" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Try Demo</Link></li>
                <li><Link href="/signup" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Sign Up</Link></li>
                <li><Link href="/login" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Sign In</Link></li>
              </ul>
            </div>

            {/* Resources */}
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Resources</h3>
              <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
                <li><a href="#features" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Features</a></li>
                <li><a href="mailto:support@adphex.com" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Support</a></li>
              </ul>
            </div>

            {/* Connect */}
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Connect</h3>
              <div className="flex gap-4">
                <a href="https://twitter.com/adphex" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-blue-500 transition-colors" aria-label="Follow us on X (Twitter)">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                </a>
                <a href="https://linkedin.com/company/adphex" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-blue-600 transition-colors" aria-label="Follow us on LinkedIn">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                </a>
                <a href="https://facebook.com/adphex" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-blue-600 transition-colors" aria-label="Follow us on Facebook">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                </a>
                <a href="https://instagram.com/adphex" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-pink-600 transition-colors" aria-label="Follow us on Instagram">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z"/></svg>
                </a>
                <a href="https://youtube.com/@adphex" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-red-600 transition-colors" aria-label="Subscribe on YouTube">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                </a>
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-slate-200 dark:border-slate-800">
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center">
              © 2024 Adphex. All rights reserved. Made with ❤️ for better financial health.
            </p>
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
