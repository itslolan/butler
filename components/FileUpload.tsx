'use client';

import { useRef, useState } from 'react';

interface FileUploadProps {
  onFileUpload: (files: File[]) => void;
  isProcessing: boolean;
}

export default function FileUpload({ onFileUpload, isProcessing }: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = (files: File[]) => {
    const validFiles = files.filter(file => {
      const isImage = file.type.startsWith('image/');
      const isPdf = file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf');
      return isImage || isPdf;
    });

    if (validFiles.length === 0) {
      if (files.length > 0) {
        alert('Please upload PDF, PNG, JPG, or similar image files.');
      }
      return;
    }

    // Separate PDFs and images
    const pdfFiles = validFiles.filter(file => 
      file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf')
    );
    const imageFiles = validFiles.filter(file => file.type.startsWith('image/'));

    // Validation: Only single PDF allowed, no mixing PDFs with images
    if (pdfFiles.length > 0) {
      if (pdfFiles.length > 1) {
        alert('Please upload only one PDF at a time.');
        return;
      }
      if (imageFiles.length > 0) {
        alert('Please upload either a single PDF or multiple images, but not both together.');
        return;
      }
      // Single PDF - valid
      onFileUpload(pdfFiles);
    } else {
      // Only images - multiple allowed
      onFileUpload(imageFiles);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFiles(files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleClick = () => {
    if (!isProcessing) {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      handleFiles(files);
    }
    // Reset input value to allow re-uploading same files if needed
    if (e.target) e.target.value = '';
  };

  return (
    <div
      onClick={handleClick}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={`
        relative group cursor-pointer rounded-xl border-2 border-dashed transition-all duration-200 ease-in-out overflow-hidden
        ${isDragging 
          ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20' 
          : 'border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 bg-white dark:bg-gray-900'
        }
        ${isProcessing ? 'opacity-60 cursor-wait' : ''}
      `}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf"
        onChange={handleFileChange}
        className="hidden"
        disabled={isProcessing}
        multiple
      />
      
      <div className="p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
            isDragging ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-300'
          }`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
              {isProcessing ? 'Uploading...' : 'Upload Statements'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {isDragging ? 'Drop files now' : 'PDFs or Images'}
            </p>
          </div>
        </div>
        
        <div className="shrink-0">
           <span className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
             isDragging 
               ? 'bg-blue-600 text-white' 
               : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 group-hover:bg-slate-200 dark:group-hover:bg-slate-700'
           }`}>
             {isProcessing ? '...' : 'Browse'}
           </span>
        </div>
      </div>

      {/* Processing Progress Bar Overlay */}
      {isProcessing && (
        <div className="absolute bottom-0 left-0 h-1 bg-blue-600 animate-pulse w-full"></div>
      )}
    </div>
  );
}
