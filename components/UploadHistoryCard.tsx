'use client';

import { UploadWithStats } from '@/lib/supabase';

interface UploadHistoryCardProps {
  upload: UploadWithStats;
  onClick: () => void;
  onDelete?: (uploadId: string) => void;
}

export default function UploadHistoryCard({ upload, onClick, onDelete }: UploadHistoryCardProps) {
  const formatDate = (dateString: string | Date | undefined) => {
    if (!dateString) return 'Unknown date';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  // Determine file types in this upload
  const hasPdf = upload.documents?.some(d => 
    d.file_name?.toLowerCase().endsWith('.pdf')
  );
  const hasImage = upload.documents?.some(d => {
    const ext = d.file_name?.toLowerCase();
    return ext?.endsWith('.png') || ext?.endsWith('.jpg') || ext?.endsWith('.jpeg') || ext?.endsWith('.webp');
  });

  // Status indicator
  const getStatusBadge = () => {
    switch (upload.status) {
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Processing
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Failed
          </span>
        );
      default:
        return null;
    }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    if (onDelete && upload.id) {
      onDelete(upload.id);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={onClick}
        className="w-full text-left bg-white dark:bg-gray-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition-all group"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-slate-900 dark:text-white text-sm line-clamp-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {upload.upload_name}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {formatDate(upload.uploaded_at)}
            </p>
          </div>
          {getStatusBadge()}
        </div>

      {/* File type icons */}
      <div className="flex items-center gap-2 mb-3">
        {hasPdf && (
          <div className="flex items-center gap-1 px-2 py-1 bg-red-50 dark:bg-red-900/20 rounded text-red-600 dark:text-red-400">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 2l5 5h-5V4zM8.5 13h1v4h-1v-4zm2 0h1.5c.5 0 1 .5 1 1s-.5 1-1 1h-.5v2h-1v-4zm4 0h1.5c.5 0 1 .5 1 1v2c0 .5-.5 1-1 1H14.5v-4z"/>
            </svg>
            <span className="text-[10px] font-medium">PDF</span>
          </div>
        )}
        {hasImage && (
          <div className="flex items-center gap-1 px-2 py-1 bg-purple-50 dark:bg-purple-900/20 rounded text-purple-600 dark:text-purple-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-[10px] font-medium">Image</span>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <span className="text-slate-600 dark:text-slate-400">
            <span className="font-semibold text-slate-900 dark:text-white">{upload.document_count}</span>
            {' '}file{upload.document_count !== 1 ? 's' : ''}
          </span>
          <span className="text-slate-600 dark:text-slate-400">
            <span className="font-semibold text-slate-900 dark:text-white">{upload.total_transactions}</span>
            {' '}transaction{upload.total_transactions !== 1 ? 's' : ''}
          </span>
        </div>
        <span className="text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity font-medium">
          View →
        </span>
      </div>

      {/* File names preview */}
      {upload.documents && upload.documents.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="flex flex-wrap gap-1">
            {upload.documents.slice(0, 3).map((doc) => (
              <span
                key={doc.id}
                className="inline-block px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[10px] text-slate-600 dark:text-slate-400 truncate max-w-[120px]"
                title={doc.file_name}
              >
                {doc.file_name}
              </span>
            ))}
            {upload.documents.length > 3 && (
              <span className="inline-block px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[10px] text-slate-500 dark:text-slate-500">
                +{upload.documents.length - 3} more
              </span>
            )}
          </div>
        </div>
      )}
    </button>

    {/* Delete button - positioned absolutely on top right */}
    {onDelete && upload.status !== 'processing' && (
      <button
        onClick={handleDeleteClick}
        className="absolute top-2 right-2 p-1.5 rounded-lg bg-white dark:bg-gray-800 border border-slate-200 dark:border-slate-700 opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-300 dark:hover:border-red-700 transition-all z-10"
        title="Delete upload"
        aria-label="Delete upload"
      >
        <svg className="w-4 h-4 text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    )}
  </div>
  );
}
