'use client';

import { useState, useEffect } from 'react';
import { Transaction } from '@/lib/supabase';

interface TodoListProps {
  userId: string;
  onSelectTodo: (todo: Transaction) => void;
  refreshTrigger?: number;
}

export default function TodoList({ userId, onSelectTodo, refreshTrigger = 0 }: TodoListProps) {
  const [todos, setTodos] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchTodos = async () => {
    if (!userId) return;
    
    setIsLoading(true);
    try {
      const res = await fetch(`/api/todos?userId=${userId}`);
      if (res.ok) {
        const data = await res.json();
        setTodos(data.todos || []);
      }
    } catch (err) {
      console.error('Error fetching todos:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTodos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, refreshTrigger]);

  // Don't render anything if there are no todos
  if (todos.length === 0 && !isLoading) {
    return null;
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
                {todos.length} transaction{todos.length !== 1 ? 's' : ''} need{todos.length === 1 ? 's' : ''} clarification
              </p>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-yellow-500 border-t-transparent"></div>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-4 px-4">
            <div className="flex gap-3 pb-2">
              {todos.map((todo) => (
                <button
                  key={todo.id}
                  onClick={() => onSelectTodo(todo)}
                  className="flex-shrink-0 w-72 bg-white dark:bg-gray-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 hover:shadow-md hover:border-yellow-400 dark:hover:border-yellow-600 transition-all group text-left"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-semibold text-slate-900 dark:text-white text-sm line-clamp-1 group-hover:text-yellow-600 dark:group-hover:text-yellow-400 transition-colors">
                      {todo.merchant}
                    </span>
                    <span className="text-sm font-mono text-slate-700 dark:text-slate-300 shrink-0 ml-2">
                      ${Math.abs(todo.amount).toFixed(2)}
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
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

