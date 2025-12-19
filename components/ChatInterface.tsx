'use client';

import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ChartRenderer from './ChartRenderer';
import AccountSelector from './AccountSelector';
import { ChartConfig } from '@/lib/chart-types';
import { Account } from '@/lib/supabase';

interface ToolCall {
  name: string;
  args: any;
  reasoning?: string;
  result?: any;
  duration?: string;
  resultCount?: number | null;
}

interface AccountSelectionData {
  type: 'screenshot' | 'statement_match';
  documentIds: string[];
  transactionCount: number;
  dateRange?: { start?: string; end?: string };
  accounts: Account[];
  // For statement match
  matchedAccount?: { id: string; displayName: string; last4?: string };
  officialName?: string;
  last4?: string;
}

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  chartConfig?: ChartConfig;
  suggestedActions?: string[];
  toolCalls?: ToolCall[];
  isStreaming?: boolean;
  accountSelection?: AccountSelectionData;
}

interface ChatInterfaceProps {
  userId?: string;
  onTodoResolved?: () => void;
  isDemoMode?: boolean;
  maxQuestions?: number;
  questionCount?: number;
  onQuestionCountChange?: (count: number) => void;
  onQuestionLimit?: () => void;
}

const ChatInterface = forwardRef(({ 
  userId = 'default-user', 
  onTodoResolved,
  isDemoMode = false,
  maxQuestions = Infinity,
  questionCount: externalQuestionCount,
  onQuestionCountChange,
  onQuestionLimit,
}: ChatInterfaceProps, ref) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [internalQuestionCount, setInternalQuestionCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Use external question count if provided, otherwise use internal state
  const questionCount = externalQuestionCount !== undefined ? externalQuestionCount : internalQuestionCount;
  
  const updateQuestionCount = (count: number) => {
    if (onQuestionCountChange) {
      onQuestionCountChange(count);
    } else {
      setInternalQuestionCount(count);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // State for account selection loading
  const [isAssigningAccount, setIsAssigningAccount] = useState(false);

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    sendSystemMessage: (content: string) => {
      setMessages(prev => [...prev, { role: 'system' as const, content }]);
    },
    resolveTodo: (transaction: any) => {
      const content = `📝 **Action Required: Clarification Needed**

I need your help categorizing this transaction:
* **TRANSACTION_ID:** ${transaction.id}
* **Merchant:** ${transaction.merchant}
* **Date:** ${new Date(transaction.date).toLocaleDateString()}
* **Amount:** $${Math.abs(transaction.amount).toFixed(2)}
* **Question:** ${transaction.clarification_question}

Please reply with the correct category or explain what this transaction is.`;
      
      // Generic fallback actions for when LLM generation fails or isn't available
      const genericActions = [
        'This is food/dining',
        'This is transportation',
        'This is shopping',
        'This is bills/utilities',
        'This is entertainment',
        'This is income'
      ];
      
      // Use LLM-generated actions if available, otherwise fall back to generic actions
      const suggestedActions = (transaction.suggested_actions && transaction.suggested_actions.length > 0)
        ? transaction.suggested_actions
        : genericActions;
      
      setMessages(prev => [...prev, { role: 'system' as const, content, suggestedActions }]);
    },
    // Show account selection for screenshots
    showAccountSelection: async (data: {
      documentIds: string[];
      transactionCount: number;
      dateRange?: { start?: string; end?: string };
      accounts?: any[]; // Optional - if provided, skip fetching
    }) => {
      try {
        let accounts = data.accounts || [];
        
        // Only fetch accounts if not provided
        if (accounts.length === 0) {
          const response = await fetch('/api/accounts');
          
          if (!response.ok) {
            const contentType = response.headers.get('content-type');
            let errorMessage = 'Failed to fetch accounts';
            
            if (contentType && contentType.includes('application/json')) {
              try {
                const errorData = await response.json();
                errorMessage = errorData.error || errorMessage;
              } catch (e) {
                // Couldn't parse JSON error
              }
            }
            
            throw new Error(errorMessage);
          }
          
          const result = await response.json();
          accounts = result.accounts || [];
        }
        
        const content = `📷 **Account Selection Required**

I've processed your screenshot(s) and found **${data.transactionCount} transaction${data.transactionCount !== 1 ? 's' : ''}**.

Please select which account these transactions belong to, or create a new account.`;

        setMessages(prev => [...prev, { 
          role: 'system' as const, 
          content,
          accountSelection: {
            type: 'screenshot',
            documentIds: data.documentIds,
            transactionCount: data.transactionCount,
            dateRange: data.dateRange,
            accounts: accounts,
          }
        }]);
      } catch (error) {
        console.error('Error fetching accounts:', error);
        setMessages(prev => [...prev, { 
          role: 'system' as const, 
          content: '❌ Error loading accounts. Please try again.' 
        }]);
      }
    },
    // Show account match confirmation for statements/Plaid
    showAccountMatchConfirmation: (data: {
      documentId: string;
      transactionCount: number;
      matchedAccount?: { id: string; displayName: string; last4?: string };
      officialName?: string;
      last4?: string;
      existingAccounts?: Array<{ id: string; displayName: string; last4?: string }>;
    }) => {
      let content: string;
      
      if (data.matchedAccount) {
        content = `🔗 **Account Match Detected**

Your document shows account: **${data.officialName || `****${data.last4}`}**

I found an existing account with matching last 4 digits:
• **${data.matchedAccount.displayName}** (****${data.matchedAccount.last4 || '????'})

**Is this the same account?**`;
      } else {
        content = `🔗 **New Account Detected**

Your document shows account: **${data.officialName || `****${data.last4}`}**

Please confirm which existing account this belongs to, or create a new one.`;
      }

      setMessages(prev => [...prev, { 
        role: 'system' as const, 
        content,
        accountSelection: {
          type: 'statement_match',
          documentIds: [data.documentId],
          transactionCount: data.transactionCount,
          accounts: (data.existingAccounts || []).map(a => ({
            id: a.id,
            user_id: userId,
            display_name: a.displayName,
            account_number_last4: a.last4 || null,
            source: 'manual' as const,
          })),
          matchedAccount: data.matchedAccount,
          officialName: data.officialName,
          last4: data.last4,
        }
      }]);
    }
  }));

  // Handle account assignment
  const handleAccountAssignment = async (
    documentIds: string[],
    accountId?: string,
    newAccount?: { display_name: string; last4?: string }
  ) => {
    setIsAssigningAccount(true);
    try {
      const response = await fetch('/api/assign-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_ids: documentIds,
          account_id: accountId,
          new_account: newAccount,
        }),
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to assign account');
      }

      // Send success message
      setMessages(prev => [...prev, { 
        role: 'system' as const, 
        content: `✅ **Account Assigned**

Successfully mapped **${result.transactions_updated} transaction${result.transactions_updated !== 1 ? 's' : ''}** to **${result.account.display_name}**${result.account_created ? ' (new account created)' : ''}.`
      }]);

      // Trigger refresh
      if (onTodoResolved) {
        onTodoResolved();
      }
    } catch (error: any) {
      console.error('Error assigning account:', error);
      setMessages(prev => [...prev, { 
        role: 'system' as const, 
        content: `❌ Error: ${error.message}` 
      }]);
    } finally {
      setIsAssigningAccount(false);
    }
  };

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    // Check if we've reached the question limit in demo mode
    if (isDemoMode && questionCount >= maxQuestions) {
      if (onQuestionLimit) {
        onQuestionLimit();
      }
      return;
    }

    const userMessage = content.trim();
    setInput('');
    
    // Increment question count for demo mode
    if (isDemoMode) {
      const newCount = questionCount + 1;
      updateQuestionCount(newCount);
      
      // Check if we've reached the limit before sending
      if (newCount > maxQuestions) {
        if (onQuestionLimit) {
          onQuestionLimit();
        }
        return;
      }
    }
    
    const newMessages = [...messages, { role: 'user' as const, content: userMessage }];
    setMessages(newMessages);
    setIsLoading(true);

    // Create placeholder assistant message
    const assistantMessageIndex = newMessages.length;
    setMessages([...newMessages, { 
      role: 'assistant', 
      content: '',
      isStreaming: true,
      toolCalls: [],
    }]);

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

      // Process the stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      let buffer = '';
      let textContent = '';
      let toolCalls: ToolCall[] = [];
      let chartConfig: ChartConfig | undefined;
      let currentToolCall: Partial<ToolCall> | null = null;

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const event = JSON.parse(line);

            switch (event.type) {
              case 'text_delta':
                textContent += event.data.text;
                setMessages(prev => {
                  const updated = [...prev];
                  updated[assistantMessageIndex] = {
                    ...updated[assistantMessageIndex],
                    content: textContent,
                  };
                  return updated;
                });
                break;

              case 'tool_call':
                currentToolCall = {
                  name: event.data.name,
                  args: event.data.args,
                  reasoning: event.data.reasoning,
                };
                toolCalls.push(currentToolCall as ToolCall);
                setMessages(prev => {
                  const updated = [...prev];
                  updated[assistantMessageIndex] = {
                    ...updated[assistantMessageIndex],
                    toolCalls: [...toolCalls],
                  };
                  return updated;
                });
                break;

              case 'tool_result':
                if (currentToolCall && currentToolCall.name === event.data.name) {
                  currentToolCall.result = event.data.result;
                  currentToolCall.duration = event.data.duration;
                  currentToolCall.resultCount = event.data.resultCount;
                  setMessages(prev => {
                    const updated = [...prev];
                    updated[assistantMessageIndex] = {
                      ...updated[assistantMessageIndex],
                      toolCalls: [...toolCalls],
                    };
                    return updated;
                  });
                }
                currentToolCall = null;
                break;

              case 'chart_config':
                chartConfig = event.data.config;
                setMessages(prev => {
                  const updated = [...prev];
                  updated[assistantMessageIndex] = {
                    ...updated[assistantMessageIndex],
                    chartConfig,
                  };
                  return updated;
                });
                break;

              case 'done':
                // Mark streaming as complete
                setMessages(prev => {
                  const updated = [...prev];
                  updated[assistantMessageIndex] = {
                    ...updated[assistantMessageIndex],
                    isStreaming: false,
                  };
                  return updated;
                });

                // Check if a transaction was categorized
                const hasCategorization = toolCalls.some(
                  call => call.name === 'categorize_transaction' && call.result?.success === true
                );
                
                if (hasCategorization && onTodoResolved) {
                  onTodoResolved();
                }
                break;

              case 'error':
                throw new Error(event.data.message);
            }
          } catch (parseError) {
            console.error('Error parsing event:', parseError, 'Line:', line);
          }
        }
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      setMessages(prev => {
        const updated = [...prev];
        updated[assistantMessageIndex] = {
          role: 'assistant',
          content: `Sorry, I encountered an error: ${error.message}. Please try again.`,
          isStreaming: false,
        };
        return updated;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Enter, but allow Shift+Enter for new lines
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
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
              Ask Adphex anything about your finances. Here are some examples:
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
                    {message.content || (message.isStreaming ? '_Thinking..._' : '')}
                  </ReactMarkdown>
                </div>
              )}
            </div>
            
            {/* Quick Actions - show after system message */}
            {message.role === 'system' && message.suggestedActions && message.suggestedActions.length > 0 && (
              <div className="mt-3 w-full max-w-[85%]">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 font-medium">Quick Actions:</p>
                <div className="flex flex-wrap gap-2">
                  {message.suggestedActions.map((action, actionIndex) => (
                    <button
                      key={actionIndex}
                      onClick={() => sendMessage(action)}
                      disabled={isLoading}
                      className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-gray-800 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 border border-slate-200 dark:border-slate-700 hover:border-yellow-400 dark:hover:border-yellow-600 rounded-lg transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {action}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {/* Account Selection - show after system message with accountSelection data */}
            {message.role === 'system' && message.accountSelection && (
              <div className="mt-3 w-full max-w-[85%]">
                <AccountSelector
                  accounts={message.accountSelection.accounts}
                  transactionCount={message.accountSelection.transactionCount}
                  dateRange={message.accountSelection.dateRange}
                  isLoading={isAssigningAccount}
                  onSelectExisting={(account) => {
                    handleAccountAssignment(
                      message.accountSelection!.documentIds,
                      account.id
                    );
                  }}
                  onCreateNew={(displayName, last4) => {
                    handleAccountAssignment(
                      message.accountSelection!.documentIds,
                      undefined,
                      { display_name: displayName, last4 }
                    );
                  }}
                />
              </div>
            )}
            
            {/* Chart rendering - show inline after assistant message */}
            {message.role === 'assistant' && message.chartConfig && (
              <div className="mt-3 w-full max-w-2xl">
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
                  <h4 className="font-semibold text-slate-900 dark:text-white mb-4 text-sm">
                    {message.chartConfig.title}
                  </h4>
                  <ChartRenderer config={message.chartConfig} height={280} showLegend />
                </div>
              </div>
            )}
            
            {/* Tool calls - show in collapsible section */}
            {message.role === 'assistant' && message.toolCalls && message.toolCalls.length > 0 && (
              <div className="mt-2 ml-1">
                <details className="group" open={message.isStreaming}>
                  <summary className="list-none cursor-pointer text-[10px] font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors flex items-center gap-1 select-none">
                    <span className="opacity-70 group-open:rotate-90 transition-transform">▶</span>
                    <span>
                      {message.isStreaming ? (
                        <>Working... ({message.toolCalls.length} tool{message.toolCalls.length !== 1 ? 's' : ''})</>
                      ) : (
                        <>Analyzed using {message.toolCalls.length} tool{message.toolCalls.length !== 1 ? 's' : ''}</>
                      )}
                    </span>
                  </summary>
                  
                  <div className="mt-2 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-800 space-y-2 text-xs max-w-xl">
                    {message.toolCalls.map((call, callIndex) => (
                      <div key={callIndex} className="space-y-1.5">
                        {call.reasoning && (
                          <div className="text-xs text-slate-600 dark:text-slate-400 italic leading-relaxed px-2 py-1.5 bg-slate-50 dark:bg-slate-800/50 rounded">
                            {call.reasoning}
                          </div>
                        )}
                        <div className="pl-2 border-l-2 border-blue-100 dark:border-blue-900/30">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-700 dark:text-slate-300">
                              {call.name}
                            </span>
                            {call.duration && (
                              <span className="text-slate-400">{call.duration}</span>
                            )}
                            {!call.result && (
                              <span className="text-blue-500 text-[10px] animate-pulse">executing...</span>
                            )}
                          </div>
                          {(() => {
                            // Filter out reasoning from args to avoid duplication
                            const { reasoning, ...argsWithoutReasoning } = call.args;
                            const hasArgs = Object.keys(argsWithoutReasoning).length > 0;
                            return hasArgs && (
                              <pre className="text-[10px] text-slate-500 dark:text-slate-500 overflow-x-auto py-0.5">
                                {JSON.stringify(argsWithoutReasoning).slice(0, 100)}{JSON.stringify(argsWithoutReasoning).length > 100 ? '...' : ''}
                              </pre>
                            );
                          })()}
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            )}
          </div>
        ))}
        
        {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
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
        {isDemoMode && questionCount >= maxQuestions ? (
          <div className="max-w-3xl mx-auto p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  You&apos;ve reached the demo limit of {maxQuestions} questions.
                </p>
                <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                  Sign up to continue asking unlimited questions.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="max-w-3xl mx-auto relative flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isDemoMode ? `Ask a question... (${maxQuestions - questionCount} remaining)` : "Ask a follow-up... (Shift+Enter for new line)"}
              disabled={isLoading || (isDemoMode && questionCount >= maxQuestions)}
              rows={1}
              className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl 
                       focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500
                       text-sm text-slate-900 dark:text-white placeholder:text-slate-400
                       disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm
                       resize-none overflow-hidden min-h-[44px] max-h-[200px]"
              style={{
                height: 'auto',
                overflowY: input.split('\n').length > 5 ? 'auto' : 'hidden'
              }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = Math.min(target.scrollHeight, 200) + 'px';
              }}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim() || (isDemoMode && questionCount >= maxQuestions)}
              className="px-4 py-3 bg-slate-900 dark:bg-blue-600 text-white rounded-xl font-medium text-sm
                       hover:bg-slate-800 dark:hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-slate-900/20 dark:focus:ring-blue-500/40
                       disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm shrink-0"
            >
              Send
            </button>
          </form>
        )}
      </div>
    </div>
  );
});

ChatInterface.displayName = 'ChatInterface';

export default ChatInterface;
