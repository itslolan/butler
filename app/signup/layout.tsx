import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Sign Up for Adphex - Free Account",
  description: "Create your free Adphex account to start tracking your finances with AI-powered insights. No credit card required.",
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    title: "Sign Up for Adphex - Free Account",
    description: "Create your free Adphex account to start tracking your finances with AI-powered insights.",
  },
};

export default function SignupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

