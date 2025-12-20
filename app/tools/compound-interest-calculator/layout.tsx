import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Compound Interest Calculator | Free Tool | Adphex',
  description: 'See how your money grows with compound interest. Calculate future value of investments with our free compound interest calculator.',
  keywords: 'compound interest calculator, investment growth calculator, compound interest formula, interest calculator, investment calculator',
  openGraph: {
    title: 'Compound Interest Calculator | Adphex',
    description: 'See how your money grows over time with the power of compound interest.',
    type: 'website',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}


