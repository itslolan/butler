import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';

const DMG_DOWNLOAD_URL = '#';

export const metadata: Metadata = {
  title: 'Adphex — Your finances. On your machine. Nowhere else.',
  description:
    'Adphex is a personal finance assistant that runs entirely on your Mac — no cloud, no subscriptions, no data leaving your device. Upload your bank statements and get instant insights powered by a local AI model.',
};

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

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0c0a12] text-white selection:bg-purple-500/20 antialiased">
      {/* Hero: copy left, screenshot right */}
      <section className="relative pt-12 pb-6 md:pt-16 md:pb-8 px-6 overflow-hidden" aria-label="Adphex for Mac">
        <div className="absolute top-20 left-1/4 w-[500px] h-[350px] bg-purple-600/[0.07] rounded-full blur-[120px] pointer-events-none" />

        <div className="max-w-7xl xl:max-w-[90rem] mx-auto relative z-10">
          <div className="grid lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] gap-8 lg:gap-3 xl:gap-4 items-center">
            <div className="text-left shrink-0 lg:max-w-md xl:max-w-lg">
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
              className="min-w-0 w-full lg:w-[70%] lg:ml-auto lg:pl-0 xl:pl-2"
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
          <a
            href={DMG_DOWNLOAD_URL}
            className="inline-flex items-center gap-3 px-8 py-4 bg-[#7c3aed] hover:bg-[#6d28d9] text-white rounded-2xl font-semibold text-lg transition-colors shadow-[0_0_80px_rgba(124,58,237,0.2)]"
          >
            <AppleLogo className="w-5 h-5" />
            Download now
            <span className="text-white/50 font-normal">&mdash; Free</span>
          </a>
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
          <a
            href={DMG_DOWNLOAD_URL}
            className="inline-flex items-center gap-3 px-8 py-4 bg-[#7c3aed] hover:bg-[#6d28d9] text-white rounded-2xl font-semibold text-lg transition-colors shadow-[0_0_60px_rgba(124,58,237,0.2)]"
          >
            <AppleLogo className="w-5 h-5" />
            Download for Mac
            <span className="text-white/50 font-normal">&mdash; Free</span>
          </a>
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
