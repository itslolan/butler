'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function PricingPage() {
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');

  const features = [
    'Auto assign budget',
    'Parse bank statements',
    'Multiple uploads',
    'Auto detect subscriptions',
  ];

  // Monthly plan details
  const monthlyPlan = {
    price: 8.99,
    period: 'month',
    checkoutUrl: 'https://checkout.dodopayments.com/buy/pdt_0NUU77bKy9NyCfachrTEU?quantity=1&redirect_url=https://adphex.com%2F',
  };

  // Yearly plan details
  const yearlyPlan = {
    price: 89.90, // 10 months at $8.99 = 2 months free
    period: 'year',
    checkoutUrl: 'https://checkout.dodopayments.com/buy/pdt_0NUUBb2mr7M0kjdLJiJ3B?quantity=1&redirect_url=https://adphex.com%2F',
    savings: 'Save 17%',
  };

  const currentPlan = billingPeriod === 'monthly' ? monthlyPlan : yearlyPlan;

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 text-slate-900 dark:text-white">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 dark:bg-gray-950/80 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 transition-all duration-300">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/20">
              A
            </div>
            <span className="font-semibold text-lg tracking-tight">Adphex</span>
          </Link>
          
          <div className="flex items-center gap-4">
            <Link 
              href="/tools"
              className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              Free Tools
            </Link>
            <Link 
              href="/login"
              className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              Sign In
            </Link>
            <Link 
              href="/signup"
              className="hidden sm:inline-flex px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Pricing Section */}
      <section className="relative pt-24 pb-32 px-6 overflow-hidden">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 text-blue-600 dark:text-blue-400 text-sm mb-8">
              <span>Simple, Transparent Pricing</span>
            </div>
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6 max-w-4xl mx-auto leading-tight">
              Choose Your <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Plan</span>
            </h1>
            <p className="text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto mb-12 leading-relaxed">
              Get access to all features with our flexible pricing. Cancel anytime.
            </p>

            {/* Billing Period Toggle */}
            <div className="flex items-center justify-center gap-4 mb-12">
              <span className={`text-sm font-medium transition-colors ${
                billingPeriod === 'monthly' ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'
              }`}>
                Monthly
              </span>
              <button
                onClick={() => setBillingPeriod(billingPeriod === 'monthly' ? 'yearly' : 'monthly')}
                className="relative w-14 h-8 bg-blue-600 rounded-full p-1 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-950"
                aria-label="Toggle billing period"
              >
                <span
                  className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-md transform transition-transform duration-300 ${
                    billingPeriod === 'yearly' ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
              <span className={`text-sm font-medium transition-colors ${
                billingPeriod === 'yearly' ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'
              }`}>
                Yearly
                {billingPeriod === 'yearly' && (
                  <span className="ml-2 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-semibold rounded-full">
                    Save 17%
                  </span>
                )}
              </span>
            </div>
          </div>

          {/* Pricing Card */}
          <div className="max-w-md mx-auto">
            <div className="bg-white dark:bg-gray-900 border-2 border-blue-600 rounded-2xl p-8 shadow-xl shadow-blue-500/10 relative overflow-hidden">
              {/* Popular Badge */}
              <div className="absolute top-0 right-0 bg-blue-600 text-white text-xs font-bold px-4 py-1 rounded-bl-lg">
                POPULAR
              </div>

              <div className="mt-4">
                <h3 className="text-2xl font-bold mb-2">Adphex {billingPeriod === 'monthly' ? 'Monthly' : 'Yearly'}</h3>
                <div className="flex items-baseline gap-2 mb-6">
                  <span className="text-5xl font-bold">${currentPlan.price}</span>
                  <span className="text-slate-500 dark:text-slate-400">/ {currentPlan.period}</span>
                </div>
                {billingPeriod === 'yearly' && (
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                    <span className="line-through text-slate-400 dark:text-slate-500">${(monthlyPlan.price * 12).toFixed(2)}</span>
                    {' '}per year (billed annually)
                  </p>
                )}

                {/* Features List */}
                <ul className="space-y-4 mb-8">
                  {features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <div className="w-5 h-5 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg className="w-3 h-3 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span className="text-slate-700 dark:text-slate-300">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA Button */}
                <a
                  href={currentPlan.checkoutUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white text-lg font-bold py-4 rounded-xl transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
                >
                  Subscribe Now
                </a>
              </div>
            </div>
          </div>

          {/* FAQ Section */}
          <div className="max-w-3xl mx-auto mt-24">
            <h2 className="text-3xl font-bold text-center mb-12">Frequently Asked Questions</h2>
            <div className="space-y-6">
              {[
                {
                  question: 'Can I cancel anytime?',
                  answer: 'Yes, you can cancel your subscription at any time. Your access will continue until the end of your billing period.',
                },
                {
                  question: 'What payment methods do you accept?',
                  answer: 'We accept all major credit cards and debit cards through our secure payment processor.',
                },
                {
                  question: 'Do you offer refunds?',
                  answer: 'We offer a 30-day money-back guarantee. If you\'re not satisfied, contact us within 30 days for a full refund.',
                },
                {
                  question: 'What happens if I switch plans?',
                  answer: 'You can switch between monthly and yearly plans at any time. Changes will be reflected in your next billing cycle.',
                },
              ].map((faq, index) => (
                <div key={index} className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
                  <h3 className="font-semibold mb-2">{faq.question}</h3>
                  <p className="text-slate-600 dark:text-slate-400">{faq.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 py-12 bg-slate-50 dark:bg-gray-900">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/20">
                A
              </div>
              <span className="font-semibold text-lg tracking-tight">Adphex</span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center">
              © 2024 Adphex. All rights reserved. Made with ❤️ for better financial health.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

