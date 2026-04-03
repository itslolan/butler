'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';

const DMG_DOWNLOAD_URL = 'https://github.com/itslolan/adphex-release/raw/refs/heads/main/Adphex-0.1.0_aarch64.dmg?download=';

function AppleLogo({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  );
}

function SunIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
    </svg>
  );
}

function EmailModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  isDark,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (email: string) => void;
  isSubmitting?: boolean;
  isDark: boolean;
}) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    onSubmit(email);
    setEmail('');
    setError('');
  };

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm ${
        isDark ? 'bg-black/80' : 'bg-black/40'
      }`}
      onClick={onClose}
    >
      <div
        className={`relative rounded-2xl shadow-2xl max-w-md w-full p-8 ${
          isDark 
            ? 'bg-[#13111a] border border-purple-500/20' 
            : 'bg-white border border-gray-200'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          disabled={isSubmitting}
          className={`absolute top-4 right-4 transition-colors disabled:opacity-50 ${
            isDark ? 'text-white/40 hover:text-white/80' : 'text-gray-400 hover:text-gray-700'
          }`}
          aria-label="Close modal"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="mb-6">
          <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Download Adphex
          </h2>
          <p className={isDark ? 'text-white/50' : 'text-gray-600'}>
            Enter your email to download Adphex for Mac
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError('');
              }}
              placeholder="your@email.com"
              disabled={isSubmitting}
              className={`w-full px-4 py-3 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-transparent transition-all disabled:opacity-50 ${
                isDark
                  ? 'bg-[#0c0a12] border border-white/10 text-white placeholder:text-white/30'
                  : 'bg-gray-50 border border-gray-300 text-gray-900 placeholder:text-gray-400'
              }`}
              autoFocus
            />
            {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full px-6 py-3 bg-[#7c3aed] hover:bg-[#6d28d9] text-white rounded-xl font-semibold transition-colors shadow-lg shadow-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Please wait...' : 'Continue to Download'}
          </button>
        </form>

        <p className={`mt-4 text-xs text-center ${isDark ? 'text-white/30' : 'text-gray-400'}`}>
          We&apos;ll only use your email to send you updates about Adphex. No spam, ever.
        </p>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const savedTheme = localStorage.getItem('adphex-theme');
    if (savedTheme === 'light') {
      setIsDark(false);
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = !isDark;
    setIsDark(newTheme);
    localStorage.setItem('adphex-theme', newTheme ? 'dark' : 'light');
  };

  const handleDownloadClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsModalOpen(true);
  };

  const handleEmailSubmit = async (email: string) => {
    setIsSubmitting(true);
    
    try {
      // Save email to database
      const response = await fetch('/api/download-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        throw new Error('Failed to save email');
      }

      // Close modal
      setIsModalOpen(false);
      
      // Trigger download
      const link = document.createElement('a');
      link.href = DMG_DOWNLOAD_URL;
      link.download = 'Adphex-0.1.0_aarch64.dmg';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error saving email:', error);
      // Still trigger download even if email save fails
      setIsModalOpen(false);
      const link = document.createElement('a');
      link.href = DMG_DOWNLOAD_URL;
      link.download = 'Adphex-0.1.0_aarch64.dmg';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`min-h-screen antialiased transition-colors ${
      isDark 
        ? 'bg-[#0c0a12] text-white selection:bg-purple-500/20' 
        : 'bg-white text-gray-900 selection:bg-purple-200'
    }`}>
      <EmailModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleEmailSubmit}
        isSubmitting={isSubmitting}
        isDark={isDark}
      />
      
      {/* Theme Toggle Button */}
      <div className="fixed top-6 right-6 z-40 flex items-center gap-3">
        <Link
          href="/blog"
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all hover:scale-105 ${
            isDark 
              ? 'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10' 
              : 'bg-gray-100 hover:bg-gray-200 text-gray-700 hover:text-gray-900 border border-gray-200'
          }`}
        >
          Blog
        </Link>
        <button
          onClick={toggleTheme}
          className={`p-3 rounded-full transition-all hover:scale-110 ${
            isDark 
              ? 'bg-white/5 hover:bg-white/10 text-white/60 hover:text-white border border-white/10' 
              : 'bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-900 border border-gray-200'
          }`}
          aria-label="Toggle theme"
        >
          {isDark ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
        </button>
      </div>
      {/* Hero: copy left, screenshot right */}
      <section className="relative pt-12 pb-6 md:pt-16 md:pb-8 px-6 overflow-hidden" aria-label="Adphex for Mac">
        <div className={`absolute top-20 left-1/4 w-[500px] h-[350px] rounded-full blur-[120px] pointer-events-none ${
          isDark ? 'bg-purple-600/[0.07]' : 'bg-purple-400/[0.08]'
        }`} />

        <div className="max-w-7xl xl:max-w-[90rem] mx-auto relative z-10">
          <div className="flex flex-col lg:flex-row justify-center items-center gap-8 lg:gap-10">
            <div className="text-left shrink-0 lg:max-w-[22rem] xl:max-w-[24rem]">
              <div className="mb-6 flex lg:justify-start justify-center">
                <Image
                  src="/adphex-logo.png"
                  alt="Adphex"
                  width={72}
                  height={72}
                  className="rounded-[18px] shadow-2xl shadow-purple-900/40"
                />
              </div>

              <h1 className={`text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-[1.08] mb-4 text-center lg:text-left ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}>
                A helping hand for your finances.
                <br />
                <span className={isDark ? 'text-purple-400/40' : 'text-purple-500/50'}>
                  Your data never leaves your Mac.
                </span>
              </h1>

              <p className={`text-base md:text-lg max-w-xl leading-relaxed text-center lg:text-left lg:mx-0 mx-auto ${
                isDark ? 'text-white/50' : 'text-gray-600'
              }`}>
                Your own personal finance advisor that runs entirely on your Mac &mdash; no cloud,
                no subscriptions, no data leaving your device.
              </p>

              <p className={`mt-4 text-sm tracking-wide text-center lg:text-left ${
                isDark ? 'text-white/30' : 'text-gray-400'
              }`}>
                Runs on Apple Silicon &middot; No internet required
              </p>
            </div>

            <div
              className="min-w-0 w-full lg:max-w-[680px] xl:max-w-[780px]"
              aria-label="Adphex desktop app preview"
            >
              <div className={`rounded-2xl overflow-hidden ${
                isDark
                  ? 'shadow-[0_20px_60px_-12px_rgba(0,0,0,0.5),0_0_80px_-20px_rgba(124,58,237,0.2)]'
                  : 'shadow-[0_8px_30px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.05)]'
              }`}>
                <Image
                  src="/adphex-desktop-chat.png"
                  alt="Adphex desktop app showing the Chat tab with a financial summary: transaction counts, income, expenses, savings rate, and category breakdown."
                  width={1024}
                  height={686}
                  className="w-full h-auto"
                  sizes="(max-width: 1024px) 100vw, (max-width: 1536px) 55vw, 700px"
                  unoptimized
                  priority
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Primary download CTA */}
      <section className="px-6 pb-16 md:pb-20" aria-label="Download Adphex">
        <div className="max-w-6xl mx-auto flex flex-col items-center text-center">
          <button
            onClick={handleDownloadClick}
            className="inline-flex items-center gap-3 px-8 py-4 bg-[#7c3aed] hover:bg-[#6d28d9] text-white rounded-2xl font-semibold text-lg transition-colors shadow-[0_0_80px_rgba(124,58,237,0.2)]"
          >
            <AppleLogo className="w-5 h-5" />
            Download now
            <span className="text-white/50 font-normal">&mdash; Free</span>
          </button>
          <p className={`mt-4 text-sm ${isDark ? 'text-white/25' : 'text-gray-400'}`}>
            For macOS &middot; Apple Silicon
          </p>
        </div>
      </section>

      {/* Divider */}
      <div className={`border-t ${isDark ? 'border-white/[0.06]' : 'border-gray-200'}`} />

      {/* Features */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <ShieldIcon className={`w-6 h-6 ${isDark ? 'text-purple-400' : 'text-purple-500'}`} />
            <span className={`text-sm font-medium tracking-wide uppercase ${
              isDark ? 'text-purple-400' : 'text-purple-600'
            }`}>
              Privacy guarantee
            </span>
          </div>
          <h2 className={`text-3xl md:text-4xl font-bold tracking-tight mb-14 max-w-2xl ${
            isDark ? 'text-white' : 'text-gray-900'
          }`}>
            So many features!
          </h2>

          <div className="grid md:grid-cols-2 gap-x-16 gap-y-12">
            <div>
              <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Smart categorization
              </h3>
              <p className={`leading-relaxed ${isDark ? 'text-white/40' : 'text-gray-600'}`}>
                Transactions are automatically grouped &mdash; food, transport, entertainment,
                subscriptions, transfers &mdash; so you see the full picture at a glance.
              </p>
            </div>

            <div>
              <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Income, expenses & savings at a glance
              </h3>
              <p className={`leading-relaxed ${isDark ? 'text-white/40' : 'text-gray-600'}`}>
                See your total income, total spending, and net savings across any date range or
                account &mdash; updated live as you upload more statements.
              </p>
            </div>

            <div>
              <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Instant transaction extraction
              </h3>
              <p className={`leading-relaxed ${isDark ? 'text-white/40' : 'text-gray-600'}`}>
                Upload a PDF and get a clean, structured list of every transaction within seconds.
              </p>
            </div>

            <div>
              <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Your private data never leaves your machine
              </h3>
              <p className={`leading-relaxed ${isDark ? 'text-white/40' : 'text-gray-600'}`}>
                Your data never leaves your machine. No accounts, no sync, no servers to hack.
              </p>
            </div>

            <div>
              <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Multi-account support
              </h3>
              <p className={`leading-relaxed ${isDark ? 'text-white/40' : 'text-gray-600'}`}>
                Checking, savings, credit card &mdash; Adphex detects account details from your
                statements and keeps everything organized.
              </p>
            </div>

            <div>
              <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Zero duplicate transactions
              </h3>
              <p className={`leading-relaxed ${isDark ? 'text-white/40' : 'text-gray-600'}`}>
                Upload statements from overlapping periods and Adphex is smart enough to
                deduplicate &mdash; so your numbers are always accurate.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Trust hook */}
      <section className="py-24 px-6">
        <div className="max-w-2xl mx-auto">
          <h2 className={`text-3xl md:text-4xl font-bold tracking-tight mb-6 ${
            isDark ? 'text-white' : 'text-gray-900'
          }`}>
            Most finance apps want your data.
            <br />
            <span className={isDark ? 'text-purple-400/40' : 'text-purple-500/50'}>We don&apos;t.</span>
          </h2>
          <div className={`space-y-5 text-lg leading-relaxed ${
            isDark ? 'text-white/50' : 'text-gray-600'
          }`}>
            <p>
              Every budgeting app, every bank integration, every &ldquo;free&rdquo; finance tool is built
              around one thing: your financial data. It gets stored on their servers, used to train
              models, sold to partners, or exposed in a breach.
            </p>
            <p>
              Adphex takes the opposite approach. The AI runs locally on your Mac. Your statements
              stay on your disk. No accounts, no sync, no servers to hack.
            </p>
          </div>
        </div>
      </section>

      <div className={`border-t ${isDark ? 'border-white/[0.06]' : 'border-gray-200'}`} />

      <div className={`border-t ${isDark ? 'border-white/[0.06]' : 'border-gray-200'}`} />

      {/* Final CTA */}
      <section className="relative py-24 px-6 overflow-hidden">
        <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full blur-[100px] pointer-events-none ${
          isDark ? 'bg-purple-600/[0.06]' : 'bg-purple-400/[0.08]'
        }`} />

        <div className="max-w-2xl mx-auto text-center relative z-10">
          <Image
            src="/adphex-logo.png"
            alt="Adphex"
            width={64}
            height={64}
            className="rounded-2xl mx-auto mb-8 shadow-lg shadow-purple-500/30"
          />
          <p className={`text-lg mb-10 ${isDark ? 'text-white/40' : 'text-gray-600'}`}>
            Download Adphex and see where your money actually goes
          </p>
          <button
            onClick={handleDownloadClick}
            className="inline-flex items-center gap-3 px-8 py-4 bg-[#7c3aed] hover:bg-[#6d28d9] text-white rounded-2xl font-semibold text-lg transition-colors shadow-[0_0_60px_rgba(124,58,237,0.2)]"
          >
            <AppleLogo className="w-5 h-5" />
            Download for Mac
            <span className="text-white/50 font-normal">&mdash; Free</span>
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className={`border-t py-8 px-6 ${
        isDark ? 'border-white/[0.06]' : 'border-gray-200'
      }`}>
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className={`flex items-center gap-2.5 text-sm ${
            isDark ? 'text-white/25' : 'text-gray-400'
          }`}>
            <Image
              src="/adphex-logo.png"
              alt="Adphex"
              width={20}
              height={20}
              className="rounded"
            />
            <span>&copy; {new Date().getFullYear()} Adphex</span>
          </div>
          <div className={`flex items-center gap-6 text-sm ${
            isDark ? 'text-white/25' : 'text-gray-400'
          }`}>
            <Link href="/privacy" className={`transition-colors ${
              isDark ? 'hover:text-white/60' : 'hover:text-gray-700'
            }`}>
              Privacy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
