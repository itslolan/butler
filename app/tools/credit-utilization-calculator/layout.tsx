import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Credit Utilization Calculator | Free Tool | Adphex',
  description: 'Calculate your credit utilization ratio and understand its impact on your credit score. Free credit utilization calculator with tips to improve.',
  keywords: 'credit utilization calculator, credit utilization ratio, credit score, credit card utilization, credit limit calculator',
  openGraph: {
    title: 'Credit Utilization Calculator | Adphex',
    description: 'Calculate your credit utilization ratio and understand its impact on your credit score.',
    type: 'website',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

