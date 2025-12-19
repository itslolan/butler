import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from '@/lib/supabase';
import {
  claimNextPendingJob,
  updateJobProgress,
  completeJob,
  failJob,
  updateUploadStatusFromJobs,
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
} from '@/lib/db-tools';
import { Transaction } from '@/lib/supabase';
import { calculateMonthlySnapshots } from '@/lib/snapshot-calculator';
import { generateSuggestedActions } from '@/lib/action-generator';
import { refreshFixedExpensesCache } from '@/lib/fixed-expenses';
import { deduplicateTransactionsSimple } from '@/lib/deduplication-test';
import { BASE_SYSTEM_PROMPT, GEMINI_MODEL } from '@/lib/gemini-prompts';

type SendUpdate = (step: string, message: string, status?: 'processing' | 'complete') => void;

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

  // Retrieve user memories to inject into system prompt
  let memoriesText = '';
  try {
    memoriesText = await getAllMemories(userId);
  } catch (error: any) {
    console.error('[worker] Error retrieving memories:', error?.message || error);
  }

  const SYSTEM_PROMPT = memoriesText
    ? `${BASE_SYSTEM_PROMPT}\n\n**User Context/Memories:**\n${memoriesText}\n\nUse these memories to help classify transactions. For example, if you know the user receives a salary of a certain amount from a specific merchant, classify similar transactions accordingly.`
    : BASE_SYSTEM_PROMPT;

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

  const geminiResponse = await model.generateContent({
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

  const content = geminiResponse.response.text();
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

  if (!isScreenshot && (extractedData.accountName || extractedData.accountNumberLast4)) {
    sendUpdate('account-check', '🔗 Checking for existing account matches...', 'processing');

    const officialName = extractedData.accountName || null;
    const last4 = extractedData.accountNumberLast4 || (extractedData.accountId ? extractedData.accountId.slice(-4) : null);

    if (last4) {
      const matchingAccounts = await findAccountsByLast4(userId, last4);

      if (matchingAccounts.length === 1) {
        accountMatchInfo = {
          needsConfirmation: true,
          matchedAccount: matchingAccounts[0],
          officialName,
          last4,
        };
        sendUpdate('account-match', `🔗 Found potential match: "${matchingAccounts[0].display_name}" (****${last4})`, 'complete');
      } else if (matchingAccounts.length > 1) {
        accountMatchInfo = {
          needsConfirmation: true,
          allAccounts: matchingAccounts,
          officialName,
          last4,
        };
        sendUpdate('account-match', `🔗 Found ${matchingAccounts.length} accounts with ****${last4} - please confirm which one`, 'complete');
      } else {
        try {
          await getOrCreateAccount(userId, {
            display_name: officialName || `Account ****${last4}`,
            account_number_last4: last4 || undefined,
            official_name: officialName || undefined,
            issuer: extractedData.issuer || undefined,
            source: 'statement',
          });
          sendUpdate('account-match', `✅ Created new account: ${officialName || `****${last4}`}`, 'complete');
        } catch (error) {
          console.error('[worker] Error creating account:', error);
          sendUpdate('account-match', '⚠️ Failed to create account, continuing...', 'complete');
        }
      }
    } else if (officialName) {
      try {
        await getOrCreateAccount(userId, {
          display_name: officialName,
          official_name: officialName,
          issuer: extractedData.issuer || undefined,
          source: 'statement',
        });
        sendUpdate('account-match', `✅ Created new account: ${officialName}`, 'complete');
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
  const needsAccountSelection = isScreenshot && !accountName;

  const batchId = uploadId || null;

  const documentEntry = {
    user_id: userId,
    file_name: fileName,
    file_url: fileUrl,
    uploaded_at: new Date().toISOString(),
    document_type: extractedData.documentType || 'unknown',
    issuer: extractedData.issuer || null,
    account_id: extractedData.accountId || null,
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
    upload_id: uploadId,
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

  if (transactionsToInsert.length > 0) {
    const transactions: Transaction[] = transactionsToInsert.map((txn: any) => ({
      user_id: userId,
      document_id: documentId,
      account_name: accountName,
      date: txn.date,
      merchant: txn.merchant,
      amount: txn.amount,
      category: txn.category || null,
      description: txn.description || null,
      transaction_type: txn.transactionType || null,
      spend_classification: txn.spendClassification || null,
      needs_clarification: txn.clarificationNeeded || false,
      clarification_question: txn.clarificationQuestion || null,
      suggested_actions: txn.suggestedActions || null,
      currency: extractedData.currency || 'USD',
      metadata: txn.metadata || {},
    }));

    await insertTransactions(transactions);
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
    }
  }

  sendUpdate('saving', '💾 Saved to database successfully', 'complete');

  const unclarifiedTransactions = await getUnclarifiedTransactions(userId, documentId);

  if (transactionsToInsert.length > 0) {
    refreshFixedExpensesCache(userId).catch(err => {
      console.error('[worker] Error refreshing fixed expenses cache:', err);
    });
  }

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
  while (true) {
    const job = await claimNextPendingJob(workerId);
    if (!job || !job.id) {
      await new Promise(r => setTimeout(r, pollIntervalMs));
      continue;
    }

    const jobId = job.id;

    const sendUpdate: SendUpdate = (step, message, status = 'processing') => {
      updateJobProgress(jobId, {
        step,
        message,
        percent: stepPercent(step, status),
        status,
        updatedAt: new Date().toISOString(),
      }).catch(err => {
        console.error('[worker] Failed to update job progress:', err);
      });
    };

    try {
      sendUpdate('download', '⬇️ Downloading file from storage...', 'processing');

      const bucket = (job as any).bucket || 'statements';
      const filePath = (job as any).file_path;
      const fileName = (job as any).file_name;

      const { data: blob, error: dlError } = await supabase.storage.from(bucket).download(filePath);
      if (dlError || !blob) {
        throw new Error(`Failed to download file: ${dlError?.message || 'No data'}`);
      }

      const buffer = Buffer.from(await blob.arrayBuffer());
      const mimeType = guessMimeType(fileName);
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath);
      const fileUrl = urlData.publicUrl;

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

      if ((job as any).upload_id) {
        await updateUploadStatusFromJobs((job as any).upload_id);
      }
    } catch (err: any) {
      const msg = err?.message || String(err);
      console.error('[worker] Job failed:', jobId, msg);

      // Retry if attempts remain (attempts is incremented during claim)
      const attempts = (job as any).attempts ?? 1;
      const maxAttempts = (job as any).max_attempts ?? 3;

      if (attempts < maxAttempts) {
        await supabase
          .from('processing_jobs')
          .update({
            status: 'pending',
            error_message: msg,
            progress: { step: 'queued', percent: 0, message: `Retrying (${attempts}/${maxAttempts})` },
          })
          .eq('id', jobId);
      } else {
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
