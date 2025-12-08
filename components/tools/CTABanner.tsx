'use client';

import Link from 'next/link';

interface CTABannerProps {
  title?: string;
  description?: string;
}

export default function CTABanner({ 
  title = "Want to automate your finances?",
  description = "Upload your bank statements and let AI analyze your spending automatically."
}: CTABannerProps) {
  return (
    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 md:p-8 text-white">
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-blue-100 mb-4">{description}</p>
      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/demo"
          className="inline-flex justify-center items-center px-5 py-2.5 bg-white text-blue-600 rounded-lg font-semibold hover:bg-blue-50 transition-colors"
        >
          Try Adphex Free
        </Link>
        <Link
          href="/signup"
          className="inline-flex justify-center items-center px-5 py-2.5 bg-blue-500/20 text-white border border-white/20 rounded-lg font-semibold hover:bg-blue-500/30 transition-colors"
        >
          Create Account
        </Link>
      </div>
    </div>
  );
}

