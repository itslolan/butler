'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

const DMG_DOWNLOAD_URL = 'https://gaddwvuybwnhcgciwfky.supabase.co/storage/v1/object/public/adphex-release/Adphex-0.1.0_aarch64.dmg';

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

function EmailModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (email: string) => void;
  isSubmitting?: boolean;
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative bg-[#13111a] border border-purple-500/20 rounded-2xl shadow-2xl max-w-md w-full p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          disabled={isSubmitting}
          className="absolute top-4 right-4 text-white/40 hover:text-white/80 transition-colors disabled:opacity-50"
          aria-label="Close modal"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-2">Download Adphex</h2>
          <p className="text-white/50">Enter your email to download Adphex for Mac</p>
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
              className="w-full px-4 py-3 bg-[#0c0a12] border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-transparent transition-all disabled:opacity-50"
              autoFocus
            />
            {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full px-6 py-3 bg-[#7c3aed] hover:bg-[#6d28d9] text-white rounded-xl font-semibold transition-colors shadow-lg shadow-purple-900/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Please wait...' : 'Continue to Download'}
          </button>
        </form>

        <p className="mt-4 text-xs text-white/30 text-center">
          We&apos;ll only use your email to send you updates about Adphex. No spam, ever.
        </p>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    <div className="min-h-screen bg-[#0c0a12] text-white selection:bg-purple-500/20 antialiased">
      <EmailModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleEmailSubmit}
        isSubmitting={isSubmitting}
      />
      {/* Hero: copy left, screenshot right */}
      <section className="relative pt-12 pb-6 md:pt-16 md:pb-8 px-6 overflow-hidden" aria-label="Adphex for Mac">
        <div className="absolute top-20 left-1/4 w-[500px] h-[350px] bg-purple-600/[0.07] rounded-full blur-[120px] pointer-events-none" />

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

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-[1.08] mb-4 text-center lg:text-left">
                Your personal financial advisor.
                <br />
                On your machine.
                <br />
                <span className="text-purple-400/40">Adphex Chat.</span>
              </h1>

              <p className="text-base md:text-lg text-white/50 max-w-xl leading-relaxed text-center lg:text-left lg:mx-0 mx-auto">
                Adphex is your own personal finance advisor that runs entirely on your Mac &mdash; no cloud,
                no subscriptions, no data leaving your device.
              </p>

              <p className="mt-4 text-sm text-white/30 tracking-wide text-center lg:text-left">
                Runs on Apple Silicon &middot; No internet required
              </p>
            </div>

            <div
              className="min-w-0 w-full lg:max-w-[680px] xl:max-w-[780px]"
              aria-label="Adphex desktop app preview"
            >
              <div className="rounded-2xl border border-purple-500/[0.12] bg-[#13111a]/50 p-1.5 sm:p-2 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.45),0_0_100px_-24px_rgba(124,58,237,0.28)] ring-1 ring-white/[0.04]">
                <Image
                  src="/adphex-desktop-chat.png"
                  alt="Adphex desktop app showing the Chat tab with a financial summary: transaction counts, income, expenses, savings rate, and category breakdown."
                  width={1024}
                  height={686}
                  className="w-full h-auto rounded-xl"
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
          <p className="mt-4 text-sm text-white/25">For macOS &middot; Apple Silicon</p>
        </div>
      </section>

      {/* Divider */}
      <div className="border-t border-white/[0.06]" />

      {/* Features */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <ShieldIcon className="w-6 h-6 text-purple-400" />
            <span className="text-sm font-medium text-purple-400 tracking-wide uppercase">Privacy guarantee</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-14 max-w-2xl">
            So many features!
          </h2>

          <div className="grid md:grid-cols-2 gap-x-16 gap-y-12">
            <div>
              <h3 className="text-lg font-semibold mb-2">Smart categorization</h3>
              <p className="text-white/40 leading-relaxed">
                Transactions are automatically grouped &mdash; food, transport, entertainment,
                subscriptions, transfers &mdash; so you see the full picture at a glance.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2">Income, expenses & savings at a glance</h3>
              <p className="text-white/40 leading-relaxed">
                See your total income, total spending, and net savings across any date range or
                account &mdash; updated live as you upload more statements.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2">Instant transaction extraction</h3>
              <p className="text-white/40 leading-relaxed">
                Upload a PDF and get a clean, structured list of every transaction within seconds.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2">Your private data never leaves your machine</h3>
              <p className="text-white/40 leading-relaxed">
                Your data never leaves your machine. No accounts, no sync, no servers to hack.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2">Multi-account support</h3>
              <p className="text-white/40 leading-relaxed">
                Checking, savings, credit card &mdash; Adphex detects account details from your
                statements and keeps everything organized.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2">Zero duplicate transactions</h3>
              <p className="text-white/40 leading-relaxed">
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
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6">
            Most finance apps want your data.
            <br />
            <span className="text-purple-400/40">We don&apos;t.</span>
          </h2>
          <div className="space-y-5 text-white/50 text-lg leading-relaxed">
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

      <div className="border-t border-white/[0.06]" />

      <div className="border-t border-white/[0.06]" />

      {/* Final CTA */}
      <section className="relative py-24 px-6 overflow-hidden">
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-purple-600/[0.06] rounded-full blur-[100px] pointer-events-none" />

        <div className="max-w-2xl mx-auto text-center relative z-10">
          <Image
            src="/adphex-logo.png"
            alt="Adphex"
            width={64}
            height={64}
            className="rounded-2xl mx-auto mb-8 shadow-lg shadow-purple-900/30"
          />
          <p className="text-white/40 text-lg mb-10">
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
      <footer className="border-t border-white/[0.06] py-8 px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 text-sm text-white/25">
            <Image
              src="/adphex-logo.png"
              alt="Adphex"
              width={20}
              height={20}
              className="rounded"
            />
            <span>&copy; {new Date().getFullYear()} Adphex</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-white/25">
            <Link href="/privacy" className="hover:text-white/60 transition-colors">
              Privacy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
