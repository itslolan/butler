import { Metadata } from 'next';
import ToolCard from '@/components/tools/ToolCard';

export const metadata: Metadata = {
  title: 'Free Financial Calculators & Tools | Adphex',
  description: 'Free financial calculators to help you budget, save, and plan. Calculate savings rate, net worth, debt payoff, and more.',
  keywords: 'financial calculator, savings rate calculator, budget calculator, net worth calculator, debt payoff calculator, compound interest calculator',
  openGraph: {
    title: 'Free Financial Calculators & Tools | Adphex',
    description: 'Free financial calculators to help you budget, save, and plan.',
    type: 'website',
  },
};

const tools = [
  {
    title: 'Savings Rate Calculator',
    description: 'Calculate what percentage of your income you\'re saving and see how you compare to top savers.',
    href: '/tools/savings-rate-calculator',
    icon: '💰',
    color: 'green' as const,
  },
  {
    title: '50/30/20 Budget Calculator',
    description: 'Use the popular 50/30/20 rule to allocate your income between needs, wants, and savings.',
    href: '/tools/50-30-20-budget-calculator',
    icon: '📊',
    color: 'blue' as const,
  },
  {
    title: 'Credit Utilization Calculator',
    description: 'Calculate your credit utilization ratio and understand its impact on your credit score.',
    href: '/tools/credit-utilization-calculator',
    icon: '💳',
    color: 'purple' as const,
  },
  {
    title: 'Emergency Fund Calculator',
    description: 'Find out how much you need in your emergency fund based on your monthly expenses.',
    href: '/tools/emergency-fund-calculator',
    icon: '🛡️',
    color: 'teal' as const,
  },
  {
    title: 'Subscription Cost Calculator',
    description: 'Add up your subscriptions to see the true annual cost of your recurring expenses.',
    href: '/tools/subscription-calculator',
    icon: '📱',
    color: 'orange' as const,
  },
  {
    title: 'Net Worth Calculator',
    description: 'Calculate your net worth by adding up your assets and subtracting your liabilities.',
    href: '/tools/net-worth-calculator',
    icon: '📈',
    color: 'green' as const,
  },
  {
    title: 'Debt Payoff Calculator',
    description: 'Compare debt snowball vs avalanche methods and see when you\'ll be debt-free.',
    href: '/tools/debt-payoff-calculator',
    icon: '🎯',
    color: 'red' as const,
  },
  {
    title: 'Compound Interest Calculator',
    description: 'See how your money grows over time with the power of compound interest.',
    href: '/tools/compound-interest-calculator',
    icon: '🌱',
    color: 'green' as const,
  },
  {
    title: 'Financial Health Quiz',
    description: 'Take a quick quiz to assess your overall financial health and get personalized tips.',
    href: '/tools/financial-health-quiz',
    icon: '❤️',
    color: 'red' as const,
  },
  {
    title: 'Inflation Calculator',
    description: 'Calculate the impact of inflation on your money over time.',
    href: '/tools/inflation-calculator',
    icon: '📉',
    color: 'orange' as const,
  },
];

export default function ToolsPage() {
  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-4">
          Free Financial Tools
        </h1>
        <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
          Powerful calculators to help you budget, save, and plan your financial future. No signup required.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {tools.map((tool) => (
          <ToolCard key={tool.href} {...tool} />
        ))}
      </div>

      <div className="mt-16 text-center">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-8 md:p-12 text-white">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            Want to automate your finances?
          </h2>
          <p className="text-lg text-blue-100 mb-6 max-w-xl mx-auto">
            Upload your bank statements and let AI analyze your spending, track your net worth, and give you personalized insights.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="/demo"
              className="inline-flex justify-center items-center px-6 py-3 bg-white text-blue-600 rounded-xl font-semibold hover:bg-blue-50 transition-colors"
            >
              Try Adphex Free
            </a>
            <a
              href="/signup"
              className="inline-flex justify-center items-center px-6 py-3 bg-blue-500/20 text-white border border-white/20 rounded-xl font-semibold hover:bg-blue-500/30 transition-colors"
            >
              Create Free Account
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}


