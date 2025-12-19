'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';

export default function UserMenu() {
  const router = useRouter();
  const { user, signOut } = useAuth();

  if (!user) return null;

  const handleSignOut = async () => {
    await signOut();
    window.location.href = '/';
  };

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => router.push('/profile')}
        className="flex items-center gap-2 text-left"
        title="View Profile"
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold hover:ring-2 hover:ring-blue-300 dark:hover:ring-blue-700 transition-all">
          {user.email?.charAt(0).toUpperCase() || 'U'}
        </div>
        <div className="hidden sm:block text-right">
          <p className="text-xs text-slate-600 dark:text-slate-400">Signed in as</p>
          <p className="text-sm font-medium text-slate-900 dark:text-white truncate max-w-[150px]">
            {user.email}
          </p>
        </div>
      </button>
      <button
        onClick={handleSignOut}
        className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
      >
        Sign Out
      </button>
    </div>
  );
}

