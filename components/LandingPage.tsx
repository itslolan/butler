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
              B
            </div>
            <span className="font-semibold text-lg tracking-tight">Butler</span>
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
            <Link 
              href="/login"
              className="w-full sm:w-auto px-8 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-semibold hover:bg-slate-800 dark:hover:bg-slate-100 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              Start Analyzing Free
            </Link>
            <a 
              href="#features"
              className="w-full sm:w-auto px-8 py-4 bg-white dark:bg-gray-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
            >
              See How It Works
            </a>
          </div>
        </div>
      </section>

      {/* Dashboard Preview */}
      <section className="px-6 pb-32">
        <div className="max-w-6xl mx-auto">
          <div className="relative rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-gray-900 shadow-2xl overflow-hidden group">
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent"></div>
            
            {/* Abstract Dashboard UI SVG */}
            <div className="w-full aspect-[16/10] bg-slate-100 dark:bg-gray-950 p-4 md:p-8 flex items-center justify-center overflow-hidden">
              <div className="w-full h-full max-w-5xl bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 flex overflow-hidden relative">
                
                {/* Left Column - Data Viz */}
                <div className="flex-1 p-6 border-r border-slate-100 dark:border-slate-800 flex flex-col gap-6 bg-slate-50/30 dark:bg-gray-900/50">
                  {/* Header / KPIs */}
                  <div className="grid grid-cols-3 gap-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-20 rounded-lg bg-white dark:bg-gray-800 border border-slate-100 dark:border-slate-700 p-3 flex flex-col justify-between shadow-sm">
                        <div className="w-16 h-2 rounded-full bg-slate-100 dark:bg-gray-700"></div>
                        <div className="w-10 h-4 rounded bg-blue-100 dark:bg-blue-900/30"></div>
                      </div>
                    ))}
                  </div>

                  {/* Main Chart Area */}
                  <div className="flex-1 rounded-xl bg-white dark:bg-gray-800 border border-slate-100 dark:border-slate-700 p-4 shadow-sm relative overflow-hidden">
                     <div className="flex justify-between items-center mb-6">
                        <div className="w-32 h-3 rounded-full bg-slate-100 dark:bg-gray-700"></div>
                        <div className="w-16 h-2 rounded-full bg-slate-100 dark:bg-gray-700"></div>
                     </div>
                     {/* Animated Line Chart SVG */}
                     <svg className="w-full h-full absolute bottom-0 left-0 right-0 p-4" preserveAspectRatio="none" viewBox="0 0 100 50">
                        <path 
                          d="M0,40 Q10,35 20,38 T40,30 T60,20 T80,25 T100,10" 
                          fill="none" 
                          stroke="url(#gradient)" 
                          strokeWidth="2"
                          className="drop-shadow-md"
                        />
                        <path 
                          d="M0,40 Q10,35 20,38 T40,30 T60,20 T80,25 T100,10 V50 H0 Z" 
                          fill="url(#fillGradient)" 
                          className="opacity-20"
                        />
                        <defs>
                          <linearGradient id="gradient" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#3B82F6" />
                            <stop offset="100%" stopColor="#6366F1" />
                          </linearGradient>
                          <linearGradient id="fillGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#3B82F6" />
                            <stop offset="100%" stopColor="transparent" />
                          </linearGradient>
                        </defs>
                        {/* Animated dots */}
                        <circle cx="20" cy="38" r="1.5" className="fill-blue-500 animate-pulse" />
                        <circle cx="60" cy="20" r="1.5" className="fill-indigo-500 animate-pulse delay-75" />
                        <circle cx="100" cy="10" r="1.5" className="fill-indigo-600 animate-pulse delay-150" />
                     </svg>
                  </div>

                  {/* Secondary Charts */}
                  <div className="h-1/3 grid grid-cols-2 gap-4">
                    <div className="rounded-xl bg-white dark:bg-gray-800 border border-slate-100 dark:border-slate-700 p-4 shadow-sm flex items-center justify-center relative">
                      {/* Pie Chart Representation */}
                      <svg viewBox="0 0 32 32" className="w-20 h-20 transform -rotate-90">
                        <circle r="16" cx="16" cy="16" fill="transparent" stroke="#E2E8F0" strokeWidth="32" className="dark:stroke-gray-700"/>
                        <circle r="16" cx="16" cy="16" fill="transparent" stroke="#3B82F6" strokeWidth="32" strokeDasharray="70 100" className="opacity-80" />
                        <circle r="16" cx="16" cy="16" fill="transparent" stroke="#6366F1" strokeWidth="32" strokeDasharray="30 100" strokeDashoffset="-70" className="opacity-80" />
                      </svg>
                    </div>
                    <div className="rounded-xl bg-white dark:bg-gray-800 border border-slate-100 dark:border-slate-700 p-4 shadow-sm flex flex-col gap-2 justify-end">
                       <div className="w-full h-2 bg-slate-100 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div className="h-full w-3/4 bg-blue-500 rounded-full"></div>
                       </div>
                       <div className="w-full h-2 bg-slate-100 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div className="h-full w-1/2 bg-indigo-500 rounded-full"></div>
                       </div>
                    </div>
                  </div>
                </div>

                {/* Right Column - Chat Interface */}
                <div className="w-1/3 flex flex-col bg-white dark:bg-gray-900 relative">
                  <div className="h-14 border-b border-slate-100 dark:border-slate-800 flex items-center px-4 gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-400/20"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-400/20"></div>
                    <div className="w-3 h-3 rounded-full bg-green-400/20"></div>
                  </div>
                  
                  <div className="flex-1 p-4 space-y-4 overflow-hidden relative">
                     {/* Chat Bubbles */}
                     <div className="flex items-start gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-gray-700 flex-shrink-0"></div>
                        <div className="bg-slate-100 dark:bg-gray-800 p-2 rounded-lg rounded-tl-none text-[10px] text-slate-400 w-3/4 space-y-1">
                           <div className="w-full h-1.5 bg-slate-300 dark:bg-gray-600 rounded"></div>
                           <div className="w-2/3 h-1.5 bg-slate-300 dark:bg-gray-600 rounded"></div>
                        </div>
                     </div>

                     <div className="flex items-start gap-2 flex-row-reverse">
                        <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex-shrink-0"></div>
                        <div className="bg-blue-600 p-2 rounded-lg rounded-tr-none w-2/3">
                           <div className="w-full h-1.5 bg-white/40 rounded mb-1"></div>
                           <div className="w-1/2 h-1.5 bg-white/40 rounded"></div>
                        </div>
                     </div>

                     <div className="flex items-start gap-2 animate-pulse">
                        <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-gray-700 flex-shrink-0"></div>
                        <div className="bg-slate-100 dark:bg-gray-800 p-2 rounded-lg rounded-tl-none w-1/2 space-y-1">
                           <div className="w-3/4 h-1.5 bg-slate-300 dark:bg-gray-600 rounded"></div>
                        </div>
                     </div>
                     
                     {/* Floating 'Processing' Card */}
                     <div className="absolute bottom-4 left-4 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-slate-100 dark:border-slate-700 p-3 flex items-center gap-3 animate-[bounce_3s_infinite]">
                        <div className="w-8 h-8 rounded bg-red-100 dark:bg-red-900/20 flex items-center justify-center text-red-500">
                           <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" /><path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" /></svg>
                        </div>
                        <div className="flex-1">
                           <div className="h-2 w-20 bg-slate-200 dark:bg-gray-600 rounded mb-1"></div>
                           <div className="h-1.5 w-12 bg-slate-100 dark:bg-gray-700 rounded"></div>
                        </div>
                        <div className="h-4 w-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></div>
                     </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 bg-slate-50 dark:bg-gray-900/50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">Everything you need to understand your cashflow</h2>
            <p className="text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
              Stop manually tagging transactions. Butler automates the tedious parts of personal finance.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, i) => (
              <div key={i} className="bg-white dark:bg-gray-900 p-8 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-blue-100 dark:hover:border-blue-900/30 hover:shadow-lg transition-all group">
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
            Join thousands who have ditched their spreadsheets for Butler&apos;s AI insights.
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
            <div className="w-6 h-6 rounded bg-slate-200 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-700 dark:text-slate-300 text-xs">B</div>
            <span>© 2025 Butler. All rights reserved.</span>
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
    description: 'Upload PDFs or images. Butler parses messy layouts and extracts clean, structured transaction data instantly.',
    icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 011.414.586l4 4a1 1 0 01.586 1.414V19a2 2 0 01-2 2z" /></svg>
  },
  {
    title: 'Smart Categorization',
    description: 'Transactions are automatically tagged as Income, Expense, or Transfers. No more manual sorting.',
    icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
  },
  {
    title: 'Duplicate Detection',
    description: 'Our advanced algorithms ensure no duplicate transactions are logged, even if you make mistakes saving them, your Butler is smart enough to take care of everything.',
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
    description: 'Butler scans the document, extracting dates, merchants, and amounts while identifying account details.',
  },
  {
    title: 'Ask Questions',
    description: 'Chat with your data. "How much did I spend on coffee last month?" or "What is my net worth trend?"',
  },
];

