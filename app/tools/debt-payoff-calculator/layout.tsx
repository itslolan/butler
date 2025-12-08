import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Debt Payoff Calculator | Snowball vs Avalanche | Adphex',
  description: 'Compare debt snowball vs avalanche methods. Calculate when you\'ll be debt-free and how much interest you\'ll save with our free debt payoff calculator.',
  keywords: 'debt payoff calculator, debt snowball, debt avalanche, debt free calculator, pay off debt, debt repayment calculator',
  openGraph: {
    title: 'Debt Payoff Calculator | Adphex',
    description: 'Compare debt snowball vs avalanche methods and see when you\'ll be debt-free.',
    type: 'website',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

