import { NextRequest, NextResponse } from 'next/server';
import { runDeduplicationTests } from '@/lib/deduplication-test';

export async function GET(request: NextRequest) {
  try {
    // Capture console output
    const logs: string[] = [];
    const originalLog = console.log;
    const originalAssert = console.assert;

    console.log = (...args) => {
      logs.push(args.join(' '));
      originalLog(...args);
    };

    console.assert = (condition, ...args) => {
      if (!condition) {
        logs.push(`ASSERTION FAILED: ${args.join(' ')}`);
      }
      originalAssert(condition, ...args);
    };

    // Run tests
    runDeduplicationTests();

    // Restore console
    console.log = originalLog;
    console.assert = originalAssert;

    return NextResponse.json({
      success: true,
      logs,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

