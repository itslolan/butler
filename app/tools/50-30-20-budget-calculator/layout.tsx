import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '50/30/20 Budget Calculator | Free Tool | Adphex',
  description: 'Use the 50/30/20 budget rule to allocate your income. Calculate how much to spend on needs, wants, and savings with our free budget calculator.',
  keywords: '50 30 20 budget, budget calculator, 50 30 20 rule, budgeting tool, how to budget, budget planner',
  openGraph: {
    title: '50/30/20 Budget Calculator | Adphex',
    description: 'Use the 50/30/20 budget rule to allocate your income between needs, wants, and savings.',
    type: 'website',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}


