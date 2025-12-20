import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Net Worth Calculator | Free Tool | Adphex',
  description: 'Calculate your net worth by adding assets and subtracting liabilities. Free net worth calculator to track your financial progress.',
  keywords: 'net worth calculator, calculate net worth, assets minus liabilities, personal net worth, wealth calculator',
  openGraph: {
    title: 'Net Worth Calculator | Adphex',
    description: 'Calculate your net worth by adding up assets and subtracting liabilities.',
    type: 'website',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}


