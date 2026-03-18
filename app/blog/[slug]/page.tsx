import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPublishedPosts, getPostBySlug, getPageBlocks } from '@/lib/notion';
import NotionBlockRenderer from '@/components/blog/notion-block-renderer';
import type { Metadata } from 'next';

export const revalidate = 60;

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://adphex.com';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const posts = await getPublishedPosts();
  return posts.map((post) => ({
    slug: post.slug,
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) {
    return {
      title: 'Post Not Found',
    };
  }

  const postUrl = `${baseUrl}/blog/${post.slug}`;
  const description = post.excerpt || `Read ${post.title} on the Adphex blog.`;

  return {
    title: post.title,
    description,
    authors: [{ name: 'Adphex' }],
    alternates: {
      canonical: postUrl,
    },
    openGraph: {
      title: post.title,
      description,
      type: 'article',
      publishedTime: post.date || undefined,
      url: postUrl,
      siteName: 'Adphex',
      authors: ['Adphex'],
      images: [
        {
          url: `${baseUrl}/og-image.png`,
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description,
      images: [`${baseUrl}/og-image.png`],
    },
  };
}

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

function calculateReadingTime(blockCount: number): number {
  return Math.max(1, Math.ceil(blockCount / 15));
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const blocks = await getPageBlocks(post.id);
  const readingTime = calculateReadingTime(blocks.length);
  const postUrl = `${baseUrl}/blog/${post.slug}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt || `Read ${post.title} on the Adphex blog.`,
    url: postUrl,
    datePublished: post.date || undefined,
    dateModified: post.date || undefined,
    author: {
      '@type': 'Organization',
      name: 'Adphex',
      url: baseUrl,
    },
    publisher: {
      '@type': 'Organization',
      name: 'Adphex',
      url: baseUrl,
      logo: {
        '@type': 'ImageObject',
        url: `${baseUrl}/icon-192.png`,
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': postUrl,
    },
    image: `${baseUrl}/og-image.png`,
    wordCount: blocks.length * 50,
    timeRequired: `PT${readingTime}M`,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="min-h-screen bg-white dark:bg-gray-950">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold shadow-sm">
                A
              </div>
              <span className="font-semibold text-lg tracking-tight text-slate-900 dark:text-white">
                Adphex
              </span>
            </Link>
            <div className="flex items-center gap-6">
              <Link
                href="/blog"
                className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                ← Back to Blog
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Article */}
      <article className="py-12 sm:py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <header className="mb-10">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 dark:text-white tracking-tight leading-tight">
              {post.title}
            </h1>

            <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
              {post.date && (
                <time dateTime={post.date} className="flex items-center gap-1.5">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  {formatDate(post.date)}
                </time>
              )}
              <span className="flex items-center gap-1.5">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                {readingTime} min read
              </span>
            </div>

            {post.excerpt && (
              <p className="mt-6 text-lg text-slate-600 dark:text-slate-400 leading-relaxed">
                {post.excerpt}
              </p>
            )}
          </header>

          {/* Divider */}
          <hr className="mb-10 border-slate-200 dark:border-slate-800" />

          {/* Content */}
          <div className="prose prose-slate dark:prose-invert max-w-none">
            <NotionBlockRenderer blocks={blocks} />
          </div>

          {/* Footer nav */}
          <div className="mt-16 pt-8 border-t border-slate-200 dark:border-slate-800">
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              Back to all posts
            </Link>
          </div>
        </div>
      </article>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 py-8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-slate-500 dark:text-slate-400">
          © {new Date().getFullYear()} Adphex. All rights reserved.
        </div>
      </footer>
    </main>
    </>
  );
}
