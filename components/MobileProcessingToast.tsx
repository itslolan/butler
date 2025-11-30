'use client';

interface MobileProcessingToastProps {
  processingSteps: Array<{ step: string; status: string; message: string; timestamp: number }>;
  lastUploadResult: string;
}

export default function MobileProcessingToast({ processingSteps, lastUploadResult }: MobileProcessingToastProps) {
  if (processingSteps.length === 0 && !lastUploadResult) {
    return null;
  }

  return (
    <div className="lg:hidden fixed bottom-20 left-4 right-4 z-30 space-y-2">
      {processingSteps.length > 0 && (
        <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 rounded-xl text-sm backdrop-blur-sm shadow-lg">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent shrink-0"></div>
          <div className="flex-1 font-medium text-blue-900 dark:text-blue-100 truncate">
            {processingSteps[processingSteps.length - 1].message}
          </div>
          <span className="text-xs text-blue-700 dark:text-blue-300 font-mono shrink-0">
            {Math.round((processingSteps.filter(s => s.status === 'complete').length / processingSteps.length) * 100)}%
          </span>
        </div>
      )}
      
      {lastUploadResult && (
        <div className={`flex items-center gap-2 p-3 rounded-xl text-sm font-medium border backdrop-blur-sm shadow-lg ${
          lastUploadResult.startsWith('✅') 
            ? 'bg-green-50 dark:bg-green-900/10 border-green-100 dark:border-green-800 text-green-800 dark:text-green-200'
            : 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-800 text-red-800 dark:text-red-200'
        }`}>
          <span className="shrink-0">{lastUploadResult.startsWith('✅') ? '✓' : '!'}</span>
          <span className="truncate">{lastUploadResult.replace(/^[✅❌]\s*/, '')}</span>
        </div>
      )}
    </div>
  );
}

