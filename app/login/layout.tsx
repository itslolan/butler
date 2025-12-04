import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Sign In to Adphex",
  description: "Sign in to your Adphex account to access your financial insights and data.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

