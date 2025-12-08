import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Financial Health Quiz | Free Assessment | Adphex',
  description: 'Take our free financial health quiz to assess your money habits. Get a personalized score and tips to improve your finances.',
  keywords: 'financial health quiz, money quiz, financial assessment, personal finance quiz, financial wellness test',
  openGraph: {
    title: 'Financial Health Quiz | Adphex',
    description: 'Take a quick quiz to assess your financial health and get personalized tips.',
    type: 'website',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

