import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Try Adphex Demo - No Signup Required",
  description: "Try Adphex's AI-powered financial assistant with sample data. Ask questions about finances and see how Adphex analyzes your data.",
  robots: {
    index: true,
    follow: true,
  },
};

export default function DemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

