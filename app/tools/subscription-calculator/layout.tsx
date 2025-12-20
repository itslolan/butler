import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Subscription Cost Calculator | Free Tool | Adphex',
  description: 'Add up all your subscriptions to see the true annual cost. Calculate how much you spend on Netflix, Spotify, and other recurring subscriptions.',
  keywords: 'subscription calculator, subscription cost, recurring expenses, netflix cost, streaming subscriptions, monthly subscriptions',
  openGraph: {
    title: 'Subscription Cost Calculator | Adphex',
    description: 'Add up all your subscriptions to see the true annual cost of recurring expenses.',
    type: 'website',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}


