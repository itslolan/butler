'use client';

import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
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
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Hello! I\'m Butler, your AI financial assistant. Ask me anything about your uploaded statements, transactions, or spending patterns.',
    },
  ]);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
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

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      {/* Chat header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          💬 Chat with Butler
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Ask questions about your financial data
        </p>
      </div>

      {/* Messages container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <div key={index}>
            <div
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                  message.role === 'user'
                    ? 'bg-blue-500 text-white'
                    : message.role === 'system'
                    ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-900 dark:text-yellow-200 border border-yellow-200 dark:border-yellow-700'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                }`}
              >
                {message.role === 'user' ? (
                  <p className="whitespace-pre-wrap break-words">{message.content}</p>
                ) : message.role === 'system' ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">🔔</span>
                      <span className="font-semibold text-sm">System Message</span>
                    </div>
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {message.content}
                      </ReactMarkdown>
                    </div>
                  </div>
                ) : (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {message.content}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
            
            {/* Debug trace - show reasoning and function calls */}
            {message.debug && (message.debug.functionCalls.length > 0 || message.debug.reasoning) && (
              <div className="mt-2 ml-4 text-sm">
                <details className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
                  <summary className="cursor-pointer font-semibold text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100">
                    🔧 Debug: {message.debug.totalCalls} function call{message.debug.totalCalls !== 1 ? 's' : ''}
                    {message.debug.reasoning && ` • 💭 Reasoning available`}
                  </summary>
                  <div className="mt-3 space-y-3">
                    
                    {/* Reasoning section */}
                    {message.debug.reasoning && message.debug.reasoning.length > 0 && (
                      <div className="border-l-2 border-purple-500 pl-3 mb-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-semibold text-purple-700 dark:text-purple-300">
                            💭 Model Reasoning
                          </span>
                        </div>
                        <div className="space-y-2">
                          {message.debug.reasoning.map((step, stepIndex) => (
                            <div key={stepIndex} className="bg-purple-50 dark:bg-purple-900/20 p-2 rounded text-xs">
                              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                                {step}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Function calls section */}
                    {message.debug.functionCalls.map((call, callIndex) => (
                      <div key={callIndex} className="border-l-2 border-blue-500 pl-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
                            {call.function}
                          </span>
                          <span className="text-xs text-gray-500">{call.duration}</span>
                          {call.resultCount !== null && (
                            <span className="text-xs text-gray-500">
                              → {call.resultCount} result{call.resultCount !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        
                        {Object.keys(call.arguments).length > 0 && (
                          <details className="mt-1">
                            <summary className="text-xs text-gray-600 dark:text-gray-400 cursor-pointer hover:text-gray-800 dark:hover:text-gray-200">
                              Arguments
                            </summary>
                            <pre className="mt-1 text-xs bg-white dark:bg-gray-900 p-2 rounded overflow-x-auto">
                              {JSON.stringify(call.arguments, null, 2)}
                            </pre>
                          </details>
                        )}
                        
                        <details className="mt-1">
                          <summary className="text-xs text-gray-600 dark:text-gray-400 cursor-pointer hover:text-gray-800 dark:hover:text-gray-200">
                            Result
                          </summary>
                          <pre className="mt-1 text-xs bg-white dark:bg-gray-900 p-2 rounded overflow-x-auto max-h-60">
                            {JSON.stringify(call.result, null, 2)}
                          </pre>
                        </details>
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            )}
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 dark:bg-gray-700 rounded-lg px-4 py-2">
              <div className="flex items-center space-x-2">
                <div className="animate-bounce">●</div>
                <div className="animate-bounce delay-100">●</div>
                <div className="animate-bounce delay-200">●</div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input form */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your finances..."
            disabled={isLoading}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                     focus:outline-none focus:ring-2 focus:ring-blue-500 
                     dark:bg-gray-700 dark:text-white
                     disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg 
                     hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500
                     disabled:opacity-50 disabled:cursor-not-allowed
                     transition-colors"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
});

ChatInterface.displayName = 'ChatInterface';

export default ChatInterface;

