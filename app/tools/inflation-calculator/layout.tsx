import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Inflation Calculator | Free Tool | Adphex',
  description: 'Calculate the impact of inflation on your money. See how purchasing power changes over time with our free inflation calculator.',
  keywords: 'inflation calculator, purchasing power calculator, inflation rate, cost of living calculator, money value over time',
  openGraph: {
    title: 'Inflation Calculator | Adphex',
    description: 'Calculate the impact of inflation on your purchasing power over time.',
    type: 'website',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}


