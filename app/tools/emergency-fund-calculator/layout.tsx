import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Emergency Fund Calculator | Free Tool | Adphex',
  description: 'Calculate how much you need in your emergency fund. Find out your target emergency savings based on your monthly expenses and job stability.',
  keywords: 'emergency fund calculator, how much emergency fund, emergency savings, rainy day fund, financial safety net',
  openGraph: {
    title: 'Emergency Fund Calculator | Adphex',
    description: 'Calculate how much you need in your emergency fund based on your expenses.',
    type: 'website',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}


