'use client';

import { useAuth } from '@/components/AuthProvider';

export default function UserMenu() {
  const { user, signOut } = useAuth();

  if (!user) return null;

  const handleSignOut = async () => {
    await signOut();
    window.location.href = '/login';
  };

  return (
    <div className="flex items-center gap-3">
      <div className="text-right">
        <p className="text-xs text-slate-600 dark:text-slate-400">Signed in as</p>
        <p className="text-sm font-medium text-slate-900 dark:text-white truncate max-w-[200px]">
          {user.email}
        </p>
      </div>
      <button
        onClick={handleSignOut}
        className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
      >
        Sign Out
      </button>
    </div>
  );
}

