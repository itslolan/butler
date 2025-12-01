'use client';

import { useState, useEffect, useRef } from 'react';
import { Transaction } from '@/lib/supabase';

interface TodoButtonProps {
  userId: string;
  onSelectTodo: (todo: Transaction) => void;
  refreshTrigger?: number;
}

export default function TodoButton({ userId, onSelectTodo, refreshTrigger = 0 }: TodoButtonProps) {
  const [todos, setTodos] = useState<Transaction[]>([]);
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

  const handleSelect = (todo: Transaction) => {
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
        title={`${todos.length} items needing clarification`}
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
        <>
          {/* Mobile backdrop */}
          <div 
            className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40 lg:hidden"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Popover - Fixed on mobile, absolute on desktop */}
          <div className="
            fixed bottom-0 left-0 right-0 
            lg:absolute lg:bottom-auto lg:left-auto lg:right-0 lg:top-full lg:mt-2
            w-full lg:w-80 xl:w-96
            max-h-[70vh] lg:max-h-[400px]
            bg-white dark:bg-gray-900 
            rounded-t-xl lg:rounded-xl 
            shadow-2xl lg:shadow-xl 
            border-t border-l border-r lg:border border-slate-200 dark:border-slate-800 
            z-50 
            overflow-hidden 
            transform transition-all duration-200 ease-out
            animate-slide-up lg:animate-none
          ">
            <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex justify-between items-center">
              <h3 className="font-semibold text-sm text-slate-900 dark:text-white">
                Action Required
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="lg:hidden p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <span className="text-xs text-slate-500 dark:text-slate-400 lg:block hidden">
                {todos.length} pending
              </span>
            </div>
            
            <div className="max-h-[calc(70vh-60px)] lg:max-h-[400px] overflow-y-auto">
              {todos.map((todo) => (
                <button
                  key={todo.id}
                  onClick={() => handleSelect(todo)}
                  className="w-full text-left p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 active:bg-slate-100 dark:active:bg-slate-800 border-b border-slate-100 dark:border-slate-800 last:border-0 transition-colors group"
                >
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
                    <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                      Resolve <span className="text-xs">→</span>
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

