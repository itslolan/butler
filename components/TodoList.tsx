'use client';

import { useState, useEffect } from 'react';
import { formatCurrency } from '@/lib/chart-utils';
import type { TodoItem } from './TodoButton';

interface TodoListProps {
  userId: string;
  onSelectTodo: (todo: TodoItem) => void;
  refreshTrigger?: number;
}

export default function TodoList({ userId, onSelectTodo, refreshTrigger = 0 }: TodoListProps) {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchTodos = async (showLoadingSpinner = true) => {
    if (!userId) return;
    
    // Only show loading spinner for initial load, not for background refreshes
    if (showLoadingSpinner && !hasLoadedOnce) {
    setIsLoading(true);
    } else if (hasLoadedOnce) {
      // Show subtle refresh indicator for background updates
      setIsRefreshing(true);
    }
    
    try {
      const res = await fetch(`/api/todos?userId=${encodeURIComponent(userId)}&_ts=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (res.ok) {
        const data = await res.json();
        setTodos(data.todos || []);
      }
    } catch (err) {
      console.error('Error fetching todos:', err);
    } finally {
      if (showLoadingSpinner && !hasLoadedOnce) {
      setIsLoading(false);
      }
      setIsRefreshing(false);
      setHasLoadedOnce(true);
    }
  };

  useEffect(() => {
    fetchTodos(true); // Initial load with spinner
    
    // Reduce polling frequency to 30 seconds (less disruptive)
    const interval = setInterval(() => fetchTodos(false), 30000);
    
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchTodos(false); // Background refresh without spinner
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, refreshTrigger]);

  const handleDismiss = async (e: React.MouseEvent, todo: TodoItem) => {
    e.stopPropagation(); // Prevent triggering onSelectTodo
    
    try {
      const res = await fetch('/api/todos/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          todoId: todo.id,
          todoType: todo.type,
          action: 'dismiss',
        }),
      });

      if (res.ok) {
        // Remove from local state immediately for instant feedback
        setTodos(prevTodos => prevTodos.filter(t => t.id !== todo.id));
      } else {
        console.error('Failed to dismiss todo');
      }
    } catch (err) {
      console.error('Error dismissing todo:', err);
    }
  };

  // Don't render anything until we've loaded once and confirmed there are todos
  // Also hide if loaded and no todos
  if (!hasLoadedOnce || todos.length === 0) {
    return null;
  }

  // Count different types
  const accountSelectionCount = todos.filter(t => t.type === 'account_selection').length;
  const transactionCount = todos.filter(t => t.type === 'transaction_clarification').length;

  // Build description
  let description = '';
  if (accountSelectionCount > 0 && transactionCount > 0) {
    description = `${accountSelectionCount} account selection${accountSelectionCount !== 1 ? 's' : ''}, ${transactionCount} transaction${transactionCount !== 1 ? 's' : ''} need attention`;
  } else if (accountSelectionCount > 0) {
    description = `${accountSelectionCount} screenshot${accountSelectionCount !== 1 ? 's' : ''} need${accountSelectionCount === 1 ? 's' : ''} account selection`;
  } else {
    description = `${transactionCount} transaction${transactionCount !== 1 ? 's' : ''} need${transactionCount === 1 ? 's' : ''} clarification`;
  }

  return (
    <div className="mb-6">
      <div className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-yellow-500 dark:bg-yellow-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white text-sm">
                Action Required
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {description}
              </p>
            </div>
          </div>
          
          {/* Subtle refresh indicator */}
          {isRefreshing && (
            <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
              <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-pulse"></div>
              <span className="text-[10px]">Updating...</span>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-yellow-500 border-t-transparent"></div>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-4 px-4">
            <div className="flex gap-3 pb-2">
              {todos.map((todo) => (
                <div
                  key={todo.id}
                  className={`relative flex-shrink-0 w-72 bg-white dark:bg-gray-800 border rounded-lg hover:shadow-md transition-all group ${
                    todo.type === 'account_selection'
                      ? 'border-purple-200 dark:border-purple-800 hover:border-purple-400 dark:hover:border-purple-600'
                      : 'border-slate-200 dark:border-slate-700 hover:border-yellow-400 dark:hover:border-yellow-600'
                  }`}
                >
                  <button
                    onClick={() => onSelectTodo(todo)}
                    className="w-full text-left p-4 pr-10"
                  >
                    {todo.type === 'account_selection' ? (
                      // Account selection todo
                      <>
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-semibold text-slate-900 dark:text-white text-sm line-clamp-1 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                            📷 {todo.file_name}
                          </span>
                          <span className="text-xs font-mono text-purple-600 dark:text-purple-400 shrink-0 ml-2 bg-purple-50 dark:bg-purple-900/30 px-1.5 py-0.5 rounded">
                            {todo.transaction_count} txn{todo.transaction_count !== 1 ? 's' : ''}
                          </span>
                        </div>
                        
                        <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 mb-2">
                          {todo.clarification_question}
                        </p>
                        
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-purple-500 dark:text-purple-400 font-medium bg-purple-50 dark:bg-purple-900/20 px-1.5 py-0.5 rounded">
                            Account Selection
                          </span>
                          <span className="text-xs font-medium text-purple-600 dark:text-purple-400 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            Select <span>→</span>
                          </span>
                        </div>
                      </>
                    ) : (
                      // Transaction clarification todo
                      <>
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-semibold text-slate-900 dark:text-white text-sm line-clamp-1 group-hover:text-yellow-600 dark:group-hover:text-yellow-400 transition-colors">
                            {todo.merchant}
                          </span>
                          <span className="text-sm font-mono text-slate-700 dark:text-slate-300 shrink-0 ml-2">
                            {formatCurrency(Math.abs(todo.amount), todo.currency || 'USD')}
                          </span>
                        </div>
                        
                        <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 mb-2">
                          {todo.clarification_question}
                        </p>
                        
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-slate-400">
                            {new Date(todo.date).toLocaleDateString()}
                          </span>
                          <span className="text-xs font-medium text-yellow-600 dark:text-yellow-400 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            Resolve <span>→</span>
                          </span>
                        </div>
                      </>
                    )}
                  </button>
                  {/* Dismiss button */}
                  <button
                    onClick={(e) => handleDismiss(e, todo)}
                    className="absolute top-2 right-2 p-1.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors opacity-0 group-hover:opacity-100"
                    title="Dismiss without resolving"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

