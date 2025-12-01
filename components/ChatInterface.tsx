'use client';

import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ChartRenderer from './ChartRenderer';
import { ChartConfig } from '@/lib/chart-types';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  chartConfig?: ChartConfig;
  debug?: {
    functionCalls: Array<{
      function: string;
      arguments: any;
      result: any;
      duration: string;
      resultCount: number | null;
    }>;
    totalCalls: number;
    reasoning?: string[] | null;
  };
}

interface ChatInterfaceProps {
  userId?: string;
}

const ChatInterface = forwardRef(({ userId = 'default-user' }: ChatInterfaceProps, ref) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    sendSystemMessage: (content: string) => {
      setMessages(prev => [...prev, { role: 'system' as const, content }]);
    },
  }));

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage = content.trim();
    setInput('');
    
    const newMessages = [...messages, { role: 'user' as const, content: userMessage }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: newMessages,
          userId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to get response');
      }

      const data = await response.json();
      setMessages([...newMessages, { 
        role: 'assistant', 
        content: data.message,
        chartConfig: data.chartConfig, // Include chart config if present
        debug: data.debug 
      }]);
    } catch (error: any) {
      console.error('Error sending message:', error);
      setMessages([
        ...newMessages,
        {
          role: 'assistant',
          content: `Sorry, I encountered an error: ${error.message}. Please try again.`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendMessage(input);
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* Messages container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
              <span className="text-xl">💬</span>
            </div>
            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
              How can I help you today?
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 max-w-xs">
              Ask Butler anything about your finances. Here are some examples:
            </p>
            
            <div className="grid gap-3 w-full max-w-sm">
              {[
                "What is my net worth?",
                "Show me my spending trend",
                "How much did I spend on food last month?",
                "Any large transactions recently?"
              ].map((question, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(question)}
                  className="px-4 py-3 text-sm text-left bg-white dark:bg-gray-800 hover:bg-slate-50 dark:hover:bg-gray-700 border border-slate-200 dark:border-slate-700 rounded-xl transition-colors shadow-sm flex items-center justify-between group"
                >
                  <span>{question}</span>
                  <span className="text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300">→</span>
                </button>
              ))}
            </div>
          </div>
        )}
        
        {messages.map((message, index) => (
          <div key={index} className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'} max-w-3xl mx-auto w-full`}>
            
            <div
              className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
                message.role === 'user'
                  ? 'bg-slate-900 dark:bg-blue-600 text-white rounded-tr-none'
                  : message.role === 'system'
                  ? 'bg-yellow-50 border border-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-200 w-full max-w-full'
                  : 'bg-white border border-slate-100 dark:bg-gray-800 dark:border-gray-700 text-slate-800 dark:text-slate-200 rounded-tl-none'
              }`}
            >
              {message.role === 'user' ? (
                <p className="whitespace-pre-wrap break-words">{message.content}</p>
              ) : message.role === 'system' ? (
                <div className="flex gap-3">
                  <span className="text-lg shrink-0">🔔</span>
                  <div className="prose prose-sm prose-yellow dark:prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {message.content}
                    </ReactMarkdown>
                  </div>
                </div>
              ) : (
                <div className="prose prose-sm prose-slate dark:prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {message.content}
                  </ReactMarkdown>
                </div>
              )}
            </div>
            
            {/* Chart rendering - show inline after assistant message */}
            {message.role === 'assistant' && message.chartConfig && (
              <div className="mt-3 w-full max-w-2xl">
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
                  <h4 className="font-semibold text-slate-900 dark:text-white mb-4 text-sm">
                    {message.chartConfig.title}
                  </h4>
                  <ChartRenderer config={message.chartConfig} height={280} />
                </div>
              </div>
            )}
            
            {/* Debug trace - show reasoning and function calls */}
            {message.debug && (message.debug.functionCalls.length > 0 || message.debug.reasoning) && (
              <div className="mt-2 ml-1">
                <details className="group">
                  <summary className="list-none cursor-pointer text-[10px] font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors flex items-center gap-1 select-none">
                    <span className="opacity-70 group-open:rotate-90 transition-transform">▶</span>
                    <span>Analyzed using {message.debug.totalCalls} tool{message.debug.totalCalls !== 1 ? 's' : ''}</span>
                  </summary>
                  
                  <div className="mt-2 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-800 space-y-3 text-xs max-w-xl">
                    {/* Reasoning section */}
                    {message.debug.reasoning && message.debug.reasoning.length > 0 && (
                      <div className="space-y-1.5">
                         <p className="font-semibold text-purple-600 dark:text-purple-400 text-[11px] uppercase tracking-wider">Reasoning</p>
                         <div className="space-y-1 pl-2 border-l-2 border-purple-100 dark:border-purple-900/30">
                          {message.debug.reasoning.map((step, stepIndex) => (
                            <p key={stepIndex} className="text-slate-600 dark:text-slate-400 leading-relaxed">
                              {step}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Function calls section */}
                    {message.debug.functionCalls.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="font-semibold text-blue-600 dark:text-blue-400 text-[11px] uppercase tracking-wider">Tools Used</p>
                        <div className="space-y-2">
                          {message.debug.functionCalls.map((call, callIndex) => (
                            <div key={callIndex} className="pl-2 border-l-2 border-blue-100 dark:border-blue-900/30">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-700 dark:text-slate-300">
                                  {call.function}
                                </span>
                                <span className="text-slate-400">{call.duration}</span>
                              </div>
                              {Object.keys(call.arguments).length > 0 && (
                                <pre className="text-[10px] text-slate-500 dark:text-slate-500 overflow-x-auto py-0.5">
                                  {JSON.stringify(call.arguments).slice(0, 100)}{JSON.stringify(call.arguments).length > 100 ? '...' : ''}
                                </pre>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </details>
              </div>
            )}
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start max-w-3xl mx-auto w-full">
            <div className="bg-white dark:bg-gray-800 border border-slate-100 dark:border-gray-700 rounded-xl px-4 py-3 rounded-tl-none shadow-sm">
              <div className="flex items-center space-x-1.5">
                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></div>
                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-75"></div>
                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-150"></div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input form */}
      <div className="p-4 bg-white dark:bg-gray-900 border-t border-slate-100 dark:border-slate-800">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto relative flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a follow-up..."
            disabled={isLoading}
            className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl 
                     focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500
                     text-sm text-slate-900 dark:text-white placeholder:text-slate-400
                     disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-4 py-3 bg-slate-900 dark:bg-blue-600 text-white rounded-xl font-medium text-sm
                     hover:bg-slate-800 dark:hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-slate-900/20 dark:focus:ring-blue-500/40
                     disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm shrink-0"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
});

ChatInterface.displayName = 'ChatInterface';

export default ChatInterface;
