'use client';

import { useState, useEffect, useRef } from 'react';
import { Transaction, Account } from '@/lib/supabase';

// Todo can be either a transaction clarification or an account selection
interface AccountSelectionTodo {
  id: string;
  type: 'account_selection';
  document_id: string;
  file_name: string;
  transaction_count: number;
  first_transaction_date?: string;
  last_transaction_date?: string;
  batch_id?: string;
  clarification_question: string;
  accounts: Account[];
}

interface TransactionTodo extends Transaction {
  type: 'transaction_clarification';
}

type TodoItem = AccountSelectionTodo | TransactionTodo;

interface TodoButtonProps {
  userId: string;
  onSelectTodo: (todo: TodoItem) => void;
  refreshTrigger?: number;
}

export default function TodoButton({ userId, onSelectTodo, refreshTrigger = 0 }: TodoButtonProps) {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

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

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSelect = (todo: TodoItem) => {
    onSelectTodo(todo);
    setIsOpen(false);
  };

  if (todos.length === 0) return null;

  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          relative p-2 rounded-full transition-all duration-200
          ${isOpen 
            ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' 
            : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
          }
        `}
        title={`${todos.length} items needing attention`}
      >
        {/* Icon: Clipboard List or Bell */}
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
        
        {/* Badge */}
        <span className="absolute top-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white dark:ring-gray-900">
          {todos.length}
        </span>
      </button>

      {/* Popover */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-80 md:w-96 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex justify-between items-center">
            <h3 className="font-semibold text-sm text-slate-900 dark:text-white">
              Action Required
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {todos.length} pending
            </span>
          </div>
          
          <div className="max-h-[400px] overflow-y-auto">
            {todos.map((todo) => (
              <button
                key={todo.id}
                onClick={() => handleSelect(todo)}
                className="w-full text-left p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 last:border-0 transition-colors group"
              >
                {todo.type === 'account_selection' ? (
                  // Account selection todo
                  <>
                    <div className="flex justify-between items-start mb-1 gap-2">
                      <span className="font-medium text-sm text-slate-900 dark:text-white line-clamp-1 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors flex-1 min-w-0">
                        📷 {todo.file_name}
                      </span>
                      <span className="text-xs font-mono text-purple-600 dark:text-purple-400 shrink-0 bg-purple-50 dark:bg-purple-900/30 px-1.5 py-0.5 rounded">
                        {todo.transaction_count} txn{todo.transaction_count !== 1 ? 's' : ''}
                      </span>
                    </div>
                    
                    <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 mb-1.5">
                      {todo.clarification_question}
                    </p>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-purple-500 dark:text-purple-400 font-medium">
                        Account Selection
                      </span>
                      <span className="text-[10px] font-medium text-purple-600 dark:text-purple-400 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        Select Account <span className="text-xs">→</span>
                      </span>
                    </div>
                  </>
                ) : (
                  // Transaction clarification todo
                  <>
                    <div className="flex justify-between items-start mb-1 gap-2">
                      <span className="font-medium text-sm text-slate-900 dark:text-white line-clamp-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors flex-1 min-w-0">
                        {todo.merchant}
                      </span>
                      <span className="text-xs font-mono text-slate-500 dark:text-slate-400 shrink-0">
                        ${Math.abs(todo.amount).toFixed(2)}
                      </span>
                    </div>
                    
                    <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 mb-1.5">
                      {todo.clarification_question}
                    </p>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-400">
                        {new Date(todo.date).toLocaleDateString()}
                      </span>
                      <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        Resolve <span className="text-xs">→</span>
                      </span>
                    </div>
                  </>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Export types for use in other components
export type { TodoItem, AccountSelectionTodo, TransactionTodo };

