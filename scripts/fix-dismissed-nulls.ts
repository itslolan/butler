/**
 * Script to fix NULL values in is_dismissed column
 * Run this with: npx tsx scripts/fix-dismissed-nulls.ts
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load environment variables from .env.local
function loadEnvFile() {
  try {
    const envPath = join(process.cwd(), '.env.local');
    const envFile = readFileSync(envPath, 'utf-8');
    const lines = envFile.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      
      const [key, ...valueParts] = trimmed.split('=');
      const value = valueParts.join('=').trim();
      
      if (key && value && !process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch (error) {
    // .env.local not found, use existing env vars
  }
}

loadEnvFile();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables:');
  console.error('- NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('- SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixDismissedNulls() {
  console.log('🔧 Starting migration to fix is_dismissed NULL values...\n');

  try {
    // Check current state
    console.log('📊 Checking current state...');
    
    const { count: nullTransactionsCount } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .is('is_dismissed', null);

    const { count: nullDocumentsCount } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .is('is_dismissed', null);

    console.log(`  - Transactions with NULL is_dismissed: ${nullTransactionsCount || 0}`);
    console.log(`  - Documents with NULL is_dismissed: ${nullDocumentsCount || 0}\n`);

    if ((nullTransactionsCount || 0) === 0 && (nullDocumentsCount || 0) === 0) {
      console.log('✅ All records already have is_dismissed set. No migration needed.');
      return;
    }

    // Update transactions
    if ((nullTransactionsCount || 0) > 0) {
      console.log('🔄 Updating transactions...');
      const { error: txnError } = await supabase
        .from('transactions')
        .update({ is_dismissed: false })
        .is('is_dismissed', null);

      if (txnError) {
        throw new Error(`Failed to update transactions: ${txnError.message}`);
      }
      console.log(`✅ Updated ${nullTransactionsCount} transactions\n`);
    }

    // Update documents
    if ((nullDocumentsCount || 0) > 0) {
      console.log('🔄 Updating documents...');
      const { error: docError } = await supabase
        .from('documents')
        .update({ is_dismissed: false })
        .is('is_dismissed', null);

      if (docError) {
        throw new Error(`Failed to update documents: ${docError.message}`);
      }
      console.log(`✅ Updated ${nullDocumentsCount} documents\n`);
    }

    // Verify final state
    console.log('✅ Migration complete! Verifying...');
    
    const { count: finalNullTransactions } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .is('is_dismissed', null);

    const { count: finalNullDocuments } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .is('is_dismissed', null);

    console.log(`  - Transactions with NULL is_dismissed: ${finalNullTransactions || 0}`);
    console.log(`  - Documents with NULL is_dismissed: ${finalNullDocuments || 0}`);

    if ((finalNullTransactions || 0) === 0 && (finalNullDocuments || 0) === 0) {
      console.log('\n🎉 Migration successful! All NULL values have been fixed.');
    } else {
      console.warn('\n⚠️  Warning: Some NULL values still remain. Please check database logs.');
    }

  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  }
}

fixDismissedNulls();

