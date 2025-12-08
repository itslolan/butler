import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Savings Rate Calculator | Free Tool | Adphex',
  description: 'Calculate your savings rate and see how you compare to other savers. Find out what percentage of your income you\'re saving with our free calculator.',
  keywords: 'savings rate calculator, savings percentage, how much should I save, savings rate formula, personal savings rate',
  openGraph: {
    title: 'Savings Rate Calculator | Adphex',
    description: 'Calculate your savings rate and see how you compare to other savers.',
    type: 'website',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

