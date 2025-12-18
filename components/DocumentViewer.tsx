'use client';

import { useState, useEffect } from 'react';

interface DocumentViewerProps {
  fileUrl: string;
  fileName: string;
  className?: string;
}

export default function DocumentViewer({ fileUrl, fileName, className = '' }: DocumentViewerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);

  // Fetch signed URL on mount or when fileUrl changes
  useEffect(() => {
    let cancelled = false;

    async function fetchSignedUrl() {
      if (!fileUrl) {
        setUrlError('No file URL provided');
        return;
      }

      try {
        setIsLoading(true);
        setUrlError(null);

        const response = await fetch('/api/storage/signed-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileUrl }),
        });

        if (!cancelled) {
          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to get signed URL');
          }

          const data = await response.json();
          setSignedUrl(data.signedUrl);
        }
      } catch (err: any) {
        if (!cancelled) {
          console.error('Failed to fetch signed URL:', err);
          setUrlError(err.message || 'Failed to load document');
          setHasError(true);
        }
      }
    }

    fetchSignedUrl();

    return () => {
      cancelled = true;
    };
  }, [fileUrl]);

  // Determine file type from extension
  const ext = fileName.toLowerCase().split('.').pop() || '';
  const isPdf = ext === 'pdf';
  const isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext);

  // Use signed URL if available, fall back to original URL
  const displayUrl = signedUrl || fileUrl;

  const handleLoad = () => {
    setIsLoading(false);
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  // Loading signed URL state
  if (!signedUrl && !urlError) {
    return (
      <div className={`flex items-center justify-center h-full bg-slate-50 dark:bg-slate-800 rounded-lg ${className}`}>
        <div className="flex flex-col items-center gap-3">
          <svg className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm text-slate-600 dark:text-slate-400">Loading document...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (hasError || urlError) {
    return (
      <div className={`flex flex-col items-center justify-center h-full bg-slate-50 dark:bg-slate-800 rounded-lg p-8 ${className}`}>
        <svg className="w-12 h-12 text-slate-400 dark:text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <p className="text-slate-600 dark:text-slate-400 text-sm text-center mb-4">
          {urlError || 'Unable to load document preview'}
        </p>
        <p className="text-slate-500 dark:text-slate-500 text-xs text-center">
          The file may not exist in storage or there was an error loading it.
        </p>
      </div>
    );
  }

  // PDF viewer
  if (isPdf) {
    return (
      <div className={`relative h-full ${className}`}>
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-50 dark:bg-slate-800 rounded-lg">
            <div className="flex flex-col items-center gap-3">
              <svg className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-sm text-slate-600 dark:text-slate-400">Loading PDF...</span>
            </div>
          </div>
        )}
        <embed
          src={displayUrl}
          type="application/pdf"
          className="w-full h-full rounded-lg border border-slate-200 dark:border-slate-700"
          onLoad={handleLoad}
          onError={handleError}
        />
      </div>
    );
  }

  // Image viewer
  if (isImage) {
    return (
      <div className={`relative h-full overflow-auto ${className}`}>
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-50 dark:bg-slate-800 rounded-lg">
            <div className="flex flex-col items-center gap-3">
              <svg className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-sm text-slate-600 dark:text-slate-400">Loading image...</span>
            </div>
          </div>
        )}
        <img
          src={displayUrl}
          alt={fileName}
          className="w-full h-auto rounded-lg border border-slate-200 dark:border-slate-700"
          onLoad={handleLoad}
          onError={handleError}
        />
      </div>
    );
  }

  // Unsupported file type
  return (
    <div className={`flex flex-col items-center justify-center h-full bg-slate-50 dark:bg-slate-800 rounded-lg p-8 ${className}`}>
      <svg className="w-12 h-12 text-slate-400 dark:text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <p className="text-slate-600 dark:text-slate-400 text-sm text-center mb-2">
        {fileName}
      </p>
      <p className="text-slate-500 dark:text-slate-500 text-xs text-center mb-4">
        Preview not available for this file type
      </p>
      <a
        href={displayUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Download File
      </a>
    </div>
  );
}
