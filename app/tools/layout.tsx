'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tools = [
  { name: 'All Tools', href: '/tools', icon: '🧰' },
  { name: 'Savings Rate', href: '/tools/savings-rate-calculator', icon: '💰' },
  { name: '50/30/20 Budget', href: '/tools/50-30-20-budget-calculator', icon: '📊' },
  { name: 'Credit Utilization', href: '/tools/credit-utilization-calculator', icon: '💳' },
  { name: 'Emergency Fund', href: '/tools/emergency-fund-calculator', icon: '🛡️' },
  { name: 'Subscription Cost', href: '/tools/subscription-calculator', icon: '📱' },
  { name: 'Net Worth', href: '/tools/net-worth-calculator', icon: '📈' },
  { name: 'Debt Payoff', href: '/tools/debt-payoff-calculator', icon: '🎯' },
  { name: 'Compound Interest', href: '/tools/compound-interest-calculator', icon: '🌱' },
  { name: 'Financial Health', href: '/tools/financial-health-quiz', icon: '❤️' },
  { name: 'Inflation Calculator', href: '/tools/inflation-calculator', icon: '📉' },
];

export default function ToolsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 dark:bg-gray-950/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/20">
              A
            </div>
            <span className="font-semibold text-lg tracking-tight text-slate-900 dark:text-white">Adphex</span>
          </Link>
          
          <div className="flex items-center gap-4">
            <Link 
              href="/tools"
              className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              Free Tools
            </Link>
            <Link 
              href="/demo"
              className="hidden sm:inline-flex px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Try Adphex Free
            </Link>
          </div>
        </div>
      </nav>

      <div className="pt-16 flex">
        {/* Sidebar - Hidden on mobile */}
        <aside className="hidden lg:block w-64 fixed left-0 top-16 bottom-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-gray-900 overflow-y-auto">
          <div className="p-4">
            <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
              Free Financial Tools
            </h2>
            <nav className="space-y-1">
              {tools.map((tool) => {
                const isActive = pathname === tool.href;
                return (
                  <Link
                    key={tool.href}
                    href={tool.href}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <span>{tool.icon}</span>
                    <span>{tool.name}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 lg:ml-64">
          {children}
        </main>
      </div>
    </div>
  );
}

