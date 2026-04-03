import Link from 'next/link';
import Image from 'next/image';
import { getPublishedPosts } from '@/lib/notion';
import type { Metadata } from 'next';

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://adphex.com';

export const metadata: Metadata = {
  title: 'Blog - Personal Finance Tips & Money Management',
  description: 'Read our latest articles about personal finance, budgeting tips, expense tracking, and money management strategies to help you achieve financial freedom.',
  keywords: ['personal finance blog', 'budgeting tips', 'money management', 'expense tracking', 'financial advice', 'saving money'],
  alternates: {
    canonical: `${baseUrl}/blog`,
  },
  openGraph: {
    title: 'Blog | Adphex - Personal Finance Tips',
    description: 'Read our latest articles about personal finance, budgeting tips, and money management strategies.',
    type: 'website',
    url: `${baseUrl}/blog`,
    siteName: 'Adphex',
    images: [
      {
        url: `${baseUrl}/og-image.png`,
        width: 1200,
        height: 630,
        alt: 'Adphex Blog - Personal Finance Tips',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Blog | Adphex - Personal Finance Tips',
    description: 'Read our latest articles about personal finance, budgeting tips, and money management strategies.',
    images: [`${baseUrl}/og-image.png`],
  },
};

export const revalidate = 60;

function formatDate(dateString: string): string {
  if (!dateString) return '';
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return dateString;
  }
}

export default async function BlogIndexPage() {
  const posts = await getPublishedPosts();

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-gray-950">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-3">
              <Image
                src="/adphex-icon.png"
                alt="Adphex"
                width={32}
                height={32}
                className="rounded-lg"
              />
              <span className="font-semibold text-lg tracking-tight text-slate-900 dark:text-white">
                Adphex
              </span>
            </Link>
            <div className="flex items-center gap-6">
              <Link
                href="/blog"
                className="text-sm font-medium text-blue-600 dark:text-blue-400"
              >
                Blog
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Header */}
      <header className="bg-gradient-to-b from-white to-slate-50 dark:from-gray-900 dark:to-gray-950 py-16 sm:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 dark:text-white tracking-tight">
            Blog
          </h1>
          <p className="mt-4 text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Insights and tips on personal finance, budgeting strategies, and making the most of your money.
          </p>
        </div>
      </header>

      {/* Posts Grid */}
      <section className="py-12 sm:py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          {posts.length === 0 ? (
            <div className="text-center py-16">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 mb-4">
                <svg
                  className="w-8 h-8 text-slate-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                No posts yet
              </h2>
              <p className="text-slate-600 dark:text-slate-400">
                Check back soon for new content.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
              {posts.map((post) => (
                <Link
                  key={post.id}
                  href={`/blog/${post.slug}`}
                  className="group block"
                >
                  <article className="h-full bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-700 transition-all duration-200">
                    <div className="flex flex-col h-full">
                      <div className="flex-1">
                        <h2 className="text-xl font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2">
                          {post.title}
                        </h2>
                        {post.excerpt && (
                          <p className="mt-3 text-slate-600 dark:text-slate-400 line-clamp-3">
                            {post.excerpt}
                          </p>
                        )}
                      </div>
                      {post.date && (
                        <time
                          dateTime={post.date}
                          className="mt-4 text-sm text-slate-500 dark:text-slate-500 block"
                        >
                          {formatDate(post.date)}
                        </time>
                      )}
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 py-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-slate-500 dark:text-slate-400">
          © {new Date().getFullYear()} Adphex. All rights reserved.
        </div>
      </footer>
    </main>
  );
}
