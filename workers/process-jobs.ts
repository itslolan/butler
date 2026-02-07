import { GoogleGenerativeAI } from '@google/generative-ai';
import { createLLMSession, logLLMCall } from '../lib/llm-logger';
import { supabase } from '../lib/supabase';
import {
  claimNextPendingJob,
  updateJobProgress,
  completeJob,
  failJob,
  updateUploadStatusFromJobs,
  generateUploadName,
  insertDocument,
  insertTransactions,
  appendMetadata,
  insertAccountSnapshots,
  getUnclarifiedTransactions,
  findMatchingTransfer,
  getAllMemories,
  searchTransactions,
  findAccountsByLast4,
  getOrCreateAccount,
} from '../lib/db-tools';
import { Transaction } from '../lib/supabase';
import { calculateMonthlySnapshots } from '../lib/snapshot-calculator';
import { generateSuggestedActions } from '../lib/action-generator';
import { applyFixedExpenseDetectionToTransactions, persistFixedExpenseFlags } from '../lib/fixed-expense-detector';
import { deduplicateTransactionsSimple } from '../lib/deduplication-test';
import { BASE_SYSTEM_PROMPT, GEMINI_MODEL } from '../lib/gemini-prompts';
import { getBudgetCategories } from '../lib/budget-utils';
import { normalizeCategoryNameKey, normalizeCategoryDisplayName } from '../lib/category-normalization';

type SendUpdate = (step: string, message: string, status?: 'processing' | 'complete') => void;

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function getLogLevel(): LogLevel {
  const v = (process.env.WORKER_LOG_LEVEL || 'info').toLowerCase();
  if (v === 'debug' || v === 'info' || v === 'warn' || v === 'error') return v;
  return 'info';
}

function shouldLog(level: LogLevel): boolean {
  const cur = getLogLevel();
  const order: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };
  return order[level] >= order[cur];
}

function safeJson(value: any): string {
  try {
    return JSON.stringify(value);
  } catch {
    return '"[unserializable]"';
  }
}

function log(level: LogLevel, message: string, meta?: Record<string, any>) {
  if (!shouldLog(level)) return;
  const ts = new Date().toISOString();
  const metaStr = meta ? ` ${safeJson(meta)}` : '';
  const line = `[worker] ${ts} ${level.toUpperCase()} ${message}${metaStr}`;
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

async function timed<T>(label: string, fn: () => Promise<T>, meta?: Record<string, any>): Promise<{ result: T; ms: number }> {
  const start = Date.now();
  try {
    const result = await fn();
    return { result, ms: Date.now() - start };
  } finally {
    // Caller logs if needed
  }
}

function guessMimeType(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  return 'application/octet-stream';
}

function stepPercent(step: string, status: 'processing' | 'complete' = 'processing'): number {
  const base: Record<string, number> = {
    queued: 0,
    download: 5,
    analysis: 35,
    detection: 40,
    account_check: 45,
    duplicate_check: 55,
    transfer_check: 60,
    action_generation: 70,
    saving: 85,
    snapshots: 92,
    complete: 100,
  };

  const normalized = step.replace(/-/g, '_');
  const pct = base[normalized] ?? (status === 'complete' ? 100 : 50);
  return Math.max(0, Math.min(100, pct));
}

async function ensureUploadExists(uploadId: string, userId: string) {
  try {
    const { data, error } = await supabase
      .from('uploads')
      .select('id')
      .eq('id', uploadId)
      .single();

    if (!error && data?.id) return;

    // If not found, Supabase returns PGRST116
    if (error && error.code !== 'PGRST116') {
      throw error;
    }
  } catch (err: any) {
    // If lookup fails for any reason other than not found, rethrow.
    if (err?.code && err.code !== 'PGRST116') throw err;
  }

  log('warn', 'Missing upload row, creating placeholder to satisfy FK', { uploadId, userId });

  const now = new Date().toISOString();
  const { error: insertError } = await supabase
    .from('uploads')
    .insert({
      id: uploadId,
      user_id: userId,
      upload_name: generateUploadName(),
      source_type: 'manual_upload',
      status: 'processing',
      uploaded_at: now,
      created_at: now,
    });

  if (insertError) {
    throw new Error(`Failed to create missing upload row for FK repair: ${insertError.message}`);
  }
}

async function processFileBuffer(opts: {
  userId: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
  fileUrl: string;
  uploadId: string | null;
  sendUpdate: SendUpdate;
}) {
  const { userId, fileName, mimeType, buffer, fileUrl, uploadId, sendUpdate } = opts;

  if (!process.env.GEMINI_API_KEY) {
    throw new Error('Gemini API key not configured');
  }

  // Retrieve user memories + existing budget categories for better category reuse
  const [memoriesText, budgetCategories] = await Promise.all([
    getAllMemories(userId).catch((error: any) => {
      console.error('[worker] Error retrieving memories:', error?.message || error);
      return '';
    }),
    getBudgetCategories(userId).catch((error: any) => {
      console.error('[worker] Error retrieving budget categories:', error?.message || error);
      return [];
    }),
  ]);

  let SYSTEM_PROMPT = BASE_SYSTEM_PROMPT;

  if (budgetCategories.length > 0) {
    const categoryNames = budgetCategories
      .map(c => c?.name)
      .filter((n): n is string => typeof n === 'string')
      .map(n => normalizeCategoryDisplayName(n))
      .filter(Boolean);

    if (categoryNames.length > 0) {
      SYSTEM_PROMPT += `\n\n**Existing Budget Categories:**\nThe user has these budget categories set up:\n${categoryNames.join(
        ', '
      )}\n\n**IMPORTANT**: When categorizing transactions, PREFER using these existing categories when applicable. Only create a new category if none of the existing ones fit.`;
    }
  }

  if (memoriesText) {
    SYSTEM_PROMPT += `\n\n**User Context/Memories:**\n${memoriesText}\n\nUse these memories to help classify transactions. For example, if you know the user receives a salary of a certain amount from a specific merchant, classify similar transactions accordingly.`;
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: { responseMimeType: 'application/json' },
  });

  sendUpdate('analysis', '🤖 Analyzing document with AI...', 'processing');

  const filePart = {
    inlineData: {
      mimeType: mimeType === 'application/octet-stream' && fileName.toLowerCase().endsWith('.pdf') ? 'application/pdf' : mimeType,
      data: buffer.toString('base64'),
    },
  };

  log('info', 'Calling Gemini for extraction', { fileName, mimeType, bytes: buffer.length });

  const sessionId = createLLMSession();
  const { result: geminiResponse, ms: geminiMs } = await timed('gemini.generateContent', async () => {
    return await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            { text: 'Extract all information from this financial document and return the structured JSON.' },
            filePart,
          ],
        },
      ],
    });
  });
  log('info', 'Gemini extraction complete', { fileName, ms: geminiMs });

  const content = geminiResponse.response.text();
  
  // Log the LLM call
  logLLMCall({
    sessionId,
    userId,
    flowName: 'job_processing',
    model: GEMINI_MODEL,
    systemPrompt: SYSTEM_PROMPT.substring(0, 3000),
    userMessage: 'Extract all information from this financial document',
    llmResult: content.substring(0, 2000),
    hasAttachments: true,
    attachmentType: filePart.inlineData.mimeType.includes('pdf') ? 'pdf' : 'image',
    durationMs: geminiMs,
  });
  
  if (!content) throw new Error('No response from Gemini');

  let extractedData: any;
  try {
    extractedData = JSON.parse(content);
  } catch {
    let cleanedContent = content;
    cleanedContent = cleanedContent.replace(/```(?:json)?\s*/g, '');
    cleanedContent = cleanedContent.replace(/```\s*/g, '');

    try {
      extractedData = JSON.parse(cleanedContent);
    } catch {
      const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('No JSON object found in response. Content preview:', content.substring(0, 500));
        throw new Error('No valid JSON object found in Gemini response');
      }
      extractedData = JSON.parse(jsonMatch[0]);
    }
  }

  sendUpdate('analysis', '🤖 Document analyzed successfully', 'complete');

  // Detect screenshot vs statement
  const sourceType = extractedData.sourceType || 'statement';
  const isScreenshot = sourceType === 'screenshot';

  // Account matching for statements (not screenshots)
  let accountMatchInfo: {
    needsConfirmation: boolean;
    matchedAccount?: any;
    officialName?: string;
    last4?: string;
    allAccounts?: any[];
  } = { needsConfirmation: false };
  
  // Track the resolved account ID to link transactions properly
  let resolvedAccountId: string | null = null;

  if (!isScreenshot && (extractedData.accountName || extractedData.accountNumberLast4)) {
    sendUpdate('account-check', '🔗 Checking for existing account matches...', 'processing');

    const officialName = extractedData.accountName || null;
    const last4 = extractedData.accountNumberLast4 || (extractedData.accountId ? extractedData.accountId.slice(-4) : null);

    if (last4) {
      const matchingAccounts = await findAccountsByLast4(userId, last4);

      if (matchingAccounts.length === 1) {
        // Found exactly one match - use it automatically
        resolvedAccountId = matchingAccounts[0].id ?? null;
        accountMatchInfo = {
          needsConfirmation: false,
          matchedAccount: matchingAccounts[0],
          officialName,
          last4,
        };
        sendUpdate('account-match', `🔗 Linked to existing account: "${matchingAccounts[0].display_name}" (****${last4})`, 'complete');
      } else if (matchingAccounts.length > 1) {
        // Multiple matches - user needs to pick (mark as pending)
        accountMatchInfo = {
          needsConfirmation: true,
          allAccounts: matchingAccounts,
          officialName,
          last4,
        };
        sendUpdate('account-match', `🔗 Found ${matchingAccounts.length} accounts with ****${last4} - please confirm which one`, 'complete');
      } else {
        // No last4 match - create new account automatically
        try {
          const { account } = await getOrCreateAccount(userId, {
            display_name: officialName || `Account ****${last4}`,
            account_number_last4: last4 || undefined,
            official_name: officialName || undefined,
            issuer: extractedData.issuer || undefined,
            source: 'statement',
          });
          resolvedAccountId = account.id ?? null;
          sendUpdate('account-match', `✅ Created new account: ${officialName || `****${last4}`}`, 'complete');
        } catch (error) {
          console.error('[worker] Error creating account:', error);
          sendUpdate('account-match', '⚠️ Failed to create account, continuing...', 'complete');
        }
      }
    } else if (officialName) {
      // No last4 but have official name - create or find by name
      try {
        const { account } = await getOrCreateAccount(userId, {
          display_name: officialName,
          official_name: officialName,
          issuer: extractedData.issuer || undefined,
          source: 'statement',
        });
        resolvedAccountId = account.id ?? null;
        sendUpdate('account-match', `✅ Linked to account: ${officialName}`, 'complete');
      } catch (error) {
        console.error('[worker] Error creating account:', error);
        sendUpdate('account-match', '⚠️ Failed to create account, continuing...', 'complete');
      }
    }
  }

  // Duplicate detection
  let transactionsToInsert = extractedData.transactions || [];
  let duplicatesInfo = { duplicatesFound: 0, duplicateExamples: [] as string[] };

  if (transactionsToInsert.length > 0 && extractedData.firstTransactionDate && extractedData.lastTransactionDate) {
    sendUpdate('duplicate-check', '🔍 Checking for duplicate transactions...', 'processing');

    const existingTransactions = await searchTransactions(userId, {
      accountName: extractedData.accountName || undefined,
      startDate: extractedData.firstTransactionDate,
      endDate: extractedData.lastTransactionDate,
    });

    if (existingTransactions.length > 0) {
      const deduplicationResult = deduplicateTransactionsSimple(
        transactionsToInsert,
        existingTransactions.map(t => ({
          date: t.date instanceof Date ? t.date.toISOString().split('T')[0] : (t.date as any),
          merchant: t.merchant,
          amount: Number(t.amount),
          category: t.category,
          description: t.description,
        }))
      );

      transactionsToInsert = deduplicationResult.uniqueTransactions;
      duplicatesInfo = {
        duplicatesFound: deduplicationResult.duplicatesFound,
        duplicateExamples: deduplicationResult.duplicateExamples,
      };
    }
  }

  // Auto-detect transfers
  if (transactionsToInsert.length > 0) {
    sendUpdate('transfer-check', '🔄 Checking for matching transfers in other accounts...', 'processing');

    for (const txn of transactionsToInsert) {
      const isPotentialTransfer =
        txn.transactionType === 'transfer' ||
        (txn.clarificationNeeded && ['expense', 'other'].includes(txn.transactionType || '')) ||
        (txn.description?.toLowerCase().includes('transfer') || txn.description?.toLowerCase().includes('payment'));

      if (isPotentialTransfer) {
        try {
          const match = await findMatchingTransfer(userId, txn.amount, txn.date);
          if (match) {
            txn.transactionType = 'transfer';
            txn.clarificationNeeded = false;
            txn.clarificationQuestion = null;
            if (!txn.metadata) txn.metadata = {};
            txn.metadata.matched_transfer_id = match.id;
            txn.metadata.matched_account_name = match.account_name;
          }
        } catch (err) {
          console.error('[worker] Error checking transfer match:', err);
        }
      }
    }
  }

  // Generate suggested actions
  if (transactionsToInsert.length > 0) {
    const transactionsNeedingActions = transactionsToInsert.filter((txn: any) => txn.clarificationNeeded);
    if (transactionsNeedingActions.length > 0) {
      sendUpdate('action-generation', `🤖 Generating smart action suggestions for ${transactionsNeedingActions.length} transaction${transactionsNeedingActions.length !== 1 ? 's' : ''}...`, 'processing');

      await Promise.all(
        transactionsNeedingActions.map(async (txn: any) => {
          try {
            const actions = await generateSuggestedActions({
              merchant: txn.merchant,
              amount: txn.amount,
              date: txn.date,
              clarificationQuestion: txn.clarificationQuestion || 'How should this transaction be categorized?',
            });
            txn.suggestedActions = actions;
          } catch (error) {
            console.error(`[worker] Failed to generate actions for ${txn.merchant}:`, error);
            txn.suggestedActions = null;
          }
        })
      );

      sendUpdate('action-generation', '✨ Action suggestions generated', 'complete');
    }
  }

  sendUpdate('saving', '💾 Saving to database...', 'processing');

  const accountName = extractedData.accountName || null;
  const accountLast4 = extractedData.accountNumberLast4 || null;
  // Ask for account selection whenever:
  // 1. Account info cannot be extracted (images OR PDFs), OR
  // 2. Multiple accounts matched and user needs to pick
  const needsAccountSelection = (!accountName && !accountLast4) ||
    (accountMatchInfo.needsConfirmation && !resolvedAccountId);

  const normalizedUploadId = uploadId && uploadId.trim() !== '' ? uploadId : null;
  const batchId = normalizedUploadId || null;

  // Ensure the uploads row exists before inserting documents with upload_id FK.
  if (normalizedUploadId) {
    sendUpdate('upload-check', '🔗 Verifying upload reference...', 'processing');
    await ensureUploadExists(normalizedUploadId, userId);
    sendUpdate('upload-check', '🔗 Upload reference verified', 'complete');
  }

  const documentEntry = {
    user_id: userId,
    file_name: fileName,
    file_url: fileUrl,
    uploaded_at: new Date().toISOString(),
    document_type: extractedData.documentType || 'unknown',
    issuer: extractedData.issuer || null,
    account_id: resolvedAccountId,  // Use the resolved account ID
    account_name: accountName,
    currency: extractedData.currency || 'USD',
    statement_date: extractedData.statementDate || null,
    previous_balance: extractedData.previousBalance || null,
    new_balance: extractedData.newBalance || null,
    credit_limit: extractedData.creditLimit || null,
    minimum_payment: extractedData.minimumPayment || null,
    due_date: extractedData.dueDate || null,
    source_type: sourceType,
    pending_account_selection: needsAccountSelection,
    upload_id: normalizedUploadId,
    batch_id: batchId,
    metadata: {
      firstTransactionDate: extractedData.firstTransactionDate || null,
      lastTransactionDate: extractedData.lastTransactionDate || null,
      duplicatesRemoved: duplicatesInfo.duplicatesFound,
      duplicateExamples: duplicatesInfo.duplicateExamples,
      accountNumberLast4: accountLast4,
    },
  };

  const insertedDoc = await insertDocument(documentEntry as any);
  const documentId = insertedDoc.id!;
  log('info', 'Inserted document', { documentId, fileName, uploadId: normalizedUploadId, userId });

  if (transactionsToInsert.length > 0) {
    const existingBudgetByKey = new Map<string, string>();
    for (const c of budgetCategories as any[]) {
      const name = c?.name;
      if (typeof name !== 'string') continue;
      existingBudgetByKey.set(normalizeCategoryNameKey(name), normalizeCategoryDisplayName(name));
    }

    const transactions: Transaction[] = transactionsToInsert.map((txn: any) => ({
      user_id: userId,
      document_id: documentId,
      account_id: resolvedAccountId,  // Link transaction to account
      account_name: accountName,
      date: txn.date,
      merchant: txn.merchant,
      amount: txn.amount,
      category:
        typeof txn.category === 'string' && txn.category.trim()
          ? existingBudgetByKey.get(normalizeCategoryNameKey(txn.category)) ?? normalizeCategoryDisplayName(txn.category)
          : null,
      description: txn.description || null,
      transaction_type: txn.transactionType || null,
      spend_classification: txn.spendClassification || null,
      needs_clarification: txn.clarificationNeeded || false,
      clarification_question: txn.clarificationQuestion || null,
      suggested_actions: txn.suggestedActions || null,
      currency: extractedData.currency || 'USD',
      metadata: txn.metadata || {},
    }));

    const insertedTransactions = await insertTransactions(transactions);
    log('info', 'Inserted transactions', { documentId, count: transactions.length, needsClarification: transactions.filter(t => t.needs_clarification).length });

    // Fixed expense detection (NEW): category-based + LLM transaction-level tagging
    // Old cadence-based fixed-expense logic is intentionally disabled.
    sendUpdate('fixed-expenses', '📌 Detecting fixed expenses...', 'processing');
    try {
      const detected = await applyFixedExpenseDetectionToTransactions(userId, insertedTransactions as any);
      await persistFixedExpenseFlags(userId, detected as any);
      sendUpdate('fixed-expenses', '📌 Fixed expenses detected', 'complete');
    } catch (e: any) {
      sendUpdate('fixed-expenses', `⚠️ Fixed expense detection skipped: ${e?.message || 'unknown error'}`, 'complete');
    }
  }

  // Append metadata summary
  const metadataSummary = extractedData.metadataSummary || 'No metadata summary provided.';
  const metadataEntry = `\n\n---\n**Document:** ${fileName} (uploaded ${new Date().toISOString()})\n\n${metadataSummary}\n`;
  await appendMetadata(userId, metadataEntry);

  // Pattern monitoring is intentionally skipped in background worker for now.

  // Monthly snapshots
  if (
    accountName &&
    extractedData.previousBalance !== undefined &&
    extractedData.newBalance !== undefined &&
    extractedData.firstTransactionDate &&
    extractedData.lastTransactionDate &&
    transactionsToInsert.length > 0
  ) {
    sendUpdate('snapshots', '📊 Calculating monthly balance snapshots...', 'processing');

    const snapshots = calculateMonthlySnapshots(
      userId,
      accountName,
      documentId,
      extractedData.previousBalance,
      extractedData.newBalance,
      extractedData.firstTransactionDate,
      extractedData.lastTransactionDate,
      transactionsToInsert.map((txn: any) => ({ date: txn.date, amount: txn.amount })),
      extractedData.currency || 'USD'
    );

    if (snapshots.length > 0) {
      await insertAccountSnapshots(snapshots);
      sendUpdate('snapshots', `📊 Saved ${snapshots.length} monthly snapshot${snapshots.length !== 1 ? 's' : ''}`, 'complete');
      log('info', 'Inserted account snapshots', { documentId, count: snapshots.length });
    }
  }

  sendUpdate('saving', '💾 Saved to database successfully', 'complete');

  const unclarifiedTransactions = await getUnclarifiedTransactions(userId, documentId);
  log('info', 'Fetched unclarified transactions', { documentId, count: unclarifiedTransactions.length });

  sendUpdate('complete', '🎉 Processing complete!', 'complete');

  return {
    id: documentId,
    fileName,
    extractedAt: new Date().toISOString(),
    documentType: extractedData.documentType,
    sourceType,
    transactionCount: transactionsToInsert.length,
    duplicatesRemoved: duplicatesInfo.duplicatesFound,
    totalTransactionsInDocument: (extractedData.transactions || []).length,
    pendingAccountSelection: needsAccountSelection,
    batchId,
    accountNumberLast4: accountLast4,
    accountMatchInfo: accountMatchInfo.needsConfirmation
      ? {
          needsConfirmation: true,
          matchedAccount: accountMatchInfo.matchedAccount
            ? {
                id: accountMatchInfo.matchedAccount.id,
                displayName: accountMatchInfo.matchedAccount.display_name,
                last4: accountMatchInfo.matchedAccount.account_number_last4,
              }
            : undefined,
          officialName: accountMatchInfo.officialName,
          last4: accountMatchInfo.last4,
          existingAccounts: accountMatchInfo.allAccounts?.map(a => ({
            id: a.id,
            displayName: a.display_name,
            last4: a.account_number_last4,
          })),
        }
      : null,
    firstTransactionDate: extractedData.firstTransactionDate || null,
    lastTransactionDate: extractedData.lastTransactionDate || null,
    unclarifiedTransactions: unclarifiedTransactions.map(t => ({
      id: t.id,
      date: t.date,
      merchant: t.merchant,
      amount: t.amount,
      clarificationQuestion: t.clarification_question,
    })),
    done: true,
  };
}

async function runSingleJobLoop(workerId: string, pollIntervalMs: number) {
  let idleCount = 0;
  while (true) {
    const job = await claimNextPendingJob(workerId);
    if (!job || !job.id) {
      idleCount++;
      if (idleCount % 15 === 0) {
        log('debug', 'No pending jobs found (idle)', { workerId, pollIntervalMs });
      }
      await new Promise(r => setTimeout(r, pollIntervalMs));
      continue;
    }

    idleCount = 0;
    const jobId = job.id;
    const jobMeta = {
      workerId,
      jobId,
      uploadId: (job as any).upload_id || null,
      userId: (job as any).user_id,
      bucket: (job as any).bucket || 'statements',
      filePath: (job as any).file_path,
      fileName: (job as any).file_name,
      attempts: (job as any).attempts,
      maxAttempts: (job as any).max_attempts,
    };
    log('info', 'Claimed job', jobMeta);

    const sendUpdate: SendUpdate = (step, message, status = 'processing') => {
      updateJobProgress(jobId, {
        step,
        message,
        percent: stepPercent(step, status),
        status,
        updatedAt: new Date().toISOString(),
      }).catch(err => {
        log('warn', 'Failed to update job progress', { jobId, step, err: err?.message || String(err) });
      });
    };

    try {
      sendUpdate('download', '⬇️ Downloading file from storage...', 'processing');

      const bucket = (job as any).bucket || 'statements';
      const filePath = (job as any).file_path;
      const fileName = (job as any).file_name;

      log('info', 'Downloading file from storage', { jobId, bucket, filePath });
      const { result: dlRes, ms: dlMs } = await timed('storage.download', async () => {
        return await supabase.storage.from(bucket).download(filePath);
      });
      const { data: blob, error: dlError } = dlRes as any;
      if (dlError || !blob) {
        throw new Error(`Failed to download file: ${dlError?.message || 'No data'}`);
      }
      log('info', 'Downloaded file from storage', { jobId, ms: dlMs });

      const buffer = Buffer.from(await blob.arrayBuffer());
      const mimeType = guessMimeType(fileName);
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath);
      const fileUrl = urlData.publicUrl;

      log('info', 'Starting processing pipeline', { jobId, mimeType, bytes: buffer.length });
      const result = await processFileBuffer({
        userId: (job as any).user_id,
        fileName,
        mimeType,
        buffer,
        fileUrl,
        uploadId: (job as any).upload_id || null,
        sendUpdate,
      });

      await completeJob(jobId, result);
      log('info', 'Job completed', { jobId, documentId: result?.id, uploadId: (job as any).upload_id || null });

      if ((job as any).upload_id) {
        await updateUploadStatusFromJobs((job as any).upload_id);
        log('debug', 'Upload status updated from jobs', { jobId, uploadId: (job as any).upload_id });
      }
    } catch (err: any) {
      const msg = err?.message || String(err);
      log('error', 'Job failed', { jobId, msg, stack: err?.stack });

      // Retry if attempts remain (attempts is incremented during claim)
      const attempts = (job as any).attempts ?? 1;
      const maxAttempts = (job as any).max_attempts ?? 3;

      if (attempts < maxAttempts) {
        log('warn', 'Re-queueing job for retry', { jobId, attempts, maxAttempts });
        await supabase
          .from('processing_jobs')
          .update({
            status: 'pending',
            error_message: msg,
            progress: { step: 'queued', percent: 0, message: `Retrying (${attempts}/${maxAttempts})` },
          })
          .eq('id', jobId);
      } else {
        log('error', 'Job exhausted retries; marking failed', { jobId, attempts, maxAttempts });
        await failJob(jobId, msg);
        if ((job as any).upload_id) {
          await updateUploadStatusFromJobs((job as any).upload_id);
        }
      }
    }
  }
}

export async function startWorker(opts: { workerId: string; concurrency: number; pollIntervalMs: number }) {
  const { workerId, concurrency, pollIntervalMs } = opts;
  const loops = Array.from({ length: Math.max(1, concurrency) }, (_, i) =>
    runSingleJobLoop(`${workerId}-${i + 1}`, pollIntervalMs)
  );
  await Promise.all(loops);
}
