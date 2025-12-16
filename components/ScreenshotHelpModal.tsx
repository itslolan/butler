'use client';

import { useState, useEffect } from 'react';

interface ScreenshotHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Platform = 'mac' | 'windows' | 'ios' | 'android';

const platformInstructions: Record<Platform, {
  name: string;
  icon: string;
  basic: { title: string; steps: string[] };
  scrolling?: { title: string; steps: string[] };
}> = {
  mac: {
    name: 'Mac',
    icon: '🍎',
    basic: {
      title: 'Basic Screenshot',
      steps: [
        'Press ⌘ + Shift + 4 to capture a selected area',
        'Press ⌘ + Shift + 3 to capture the entire screen',
        'Press ⌘ + Shift + 4, then Space to capture a window',
        'Screenshots are saved to your Desktop by default',
      ],
    },
    scrolling: {
      title: 'Scrolling Screenshot (Full Page)',
      steps: [
        'In Safari: Go to File → Export as PDF, then screenshot the PDF',
        'In Chrome: Open Developer Tools (⌘ + Option + I)',
        'Click the three dots menu → Run command → type "screenshot"',
        'Select "Capture full size screenshot"',
        'Or use apps like CleanShot X, Shottr, or Snagit for scrolling captures',
      ],
    },
  },
  windows: {
    name: 'Windows',
    icon: '🪟',
    basic: {
      title: 'Basic Screenshot',
      steps: [
        'Press Win + Shift + S to open Snipping Tool',
        'Select "Rectangle", "Window", or "Full screen" mode',
        'Click and drag to capture your selection',
        'The screenshot is copied to clipboard - paste with Ctrl + V',
        'Press PrtScn alone to capture full screen to clipboard',
      ],
    },
    scrolling: {
      title: 'Scrolling Screenshot (Full Page)',
      steps: [
        'In Edge: Press Ctrl + Shift + S → Select "Capture full page"',
        'In Chrome: Open Developer Tools (F12)',
        'Press Ctrl + Shift + P → type "screenshot"',
        'Select "Capture full size screenshot"',
        'Or use Snipping Tool\'s "Scrolling Window" feature (Windows 11)',
        'Third-party apps: ShareX (free), Snagit, or PicPick',
      ],
    },
  },
  ios: {
    name: 'iPhone / iPad',
    icon: '📱',
    basic: {
      title: 'Basic Screenshot',
      steps: [
        'iPhone with Face ID: Press Side button + Volume Up simultaneously',
        'iPhone with Home button: Press Side button + Home button simultaneously',
        'iPad: Press Top button + Volume Up (or Home button)',
        'Tap the thumbnail preview to edit or share immediately',
      ],
    },
    scrolling: {
      title: 'Full Page Screenshot (Safari)',
      steps: [
        'Take a regular screenshot using the method above',
        'Tap the screenshot preview thumbnail (bottom-left)',
        'Tap "Full Page" tab at the top of the editor',
        'This captures the entire scrollable page!',
        'Tap "Done" → "Save PDF to Files" or "Save to Photos"',
        'Note: Full Page works in Safari, Mail, and some other apps',
      ],
    },
  },
  android: {
    name: 'Android',
    icon: '🤖',
    basic: {
      title: 'Basic Screenshot',
      steps: [
        'Press Power + Volume Down buttons simultaneously',
        'Or swipe down and tap the Screenshot quick tile',
        'On some phones: swipe 3 fingers down the screen',
        'Samsung: Swipe palm edge across the screen',
        'Screenshot appears in your Photos/Gallery app',
      ],
    },
    scrolling: {
      title: 'Scrolling Screenshot',
      steps: [
        'Take a regular screenshot first',
        'Look for "Capture more" or "Scroll capture" button',
        'On Samsung: Tap the scroll icon in the toolbar',
        'On Pixel/stock Android: Tap "Capture more" button',
        'Keep tapping to extend the capture down the page',
        'Tap "Save" when you\'ve captured everything needed',
        'Note: Available on Android 12+ and most Samsung devices',
      ],
    },
  },
};

export default function ScreenshotHelpModal({ isOpen, onClose }: ScreenshotHelpModalProps) {
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>('mac');

  // Auto-detect platform on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const userAgent = navigator.userAgent.toLowerCase();
      if (/iphone|ipad|ipod/.test(userAgent)) {
        setSelectedPlatform('ios');
      } else if (/android/.test(userAgent)) {
        setSelectedPlatform('android');
      } else if (/mac/.test(userAgent)) {
        setSelectedPlatform('mac');
      } else if (/win/.test(userAgent)) {
        setSelectedPlatform('windows');
      }
    }
  }, []);

  if (!isOpen) return null;

  const currentPlatform = platformInstructions[selectedPlatform];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                How to Take Screenshots
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Capture your bank app or website
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Platform Selector */}
        <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex gap-2">
            {(Object.keys(platformInstructions) as Platform[]).map((platform) => (
              <button
                key={platform}
                onClick={() => setSelectedPlatform(platform)}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  selectedPlatform === platform
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500/20'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <span>{platformInstructions[platform].icon}</span>
                <span className="hidden sm:inline">{platformInstructions[platform].name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Instructions Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Basic Screenshot */}
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white mb-3">
              <span className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xs">1</span>
              {currentPlatform.basic.title}
            </h3>
            <ul className="space-y-2 ml-8">
              {currentPlatform.basic.steps.map((step, index) => (
                <li key={index} className="text-sm text-slate-600 dark:text-slate-300 flex items-start gap-2">
                  <span className="text-slate-400 mt-1">•</span>
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Scrolling Screenshot */}
          {currentPlatform.scrolling && (
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white mb-3">
                <span className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center text-xs">2</span>
                {currentPlatform.scrolling.title}
                <span className="ml-2 px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-xs rounded-full">
                  Recommended
                </span>
              </h3>
              <ul className="space-y-2 ml-8">
                {currentPlatform.scrolling.steps.map((step, index) => (
                  <li key={index} className="text-sm text-slate-600 dark:text-slate-300 flex items-start gap-2">
                    <span className="text-slate-400 mt-1">•</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Tips */}
          <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl">
            <h4 className="flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-300 mb-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              Tips for Best Results
            </h4>
            <ul className="text-sm text-amber-700 dark:text-amber-300/80 space-y-1">
              <li>• Make sure all transaction details are visible</li>
              <li>• Include dates, amounts, and merchant names</li>
              <li>• Capture the account name/number if visible</li>
              <li>• Scrolling screenshots capture more data at once</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 shrink-0">
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-medium hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors"
          >
            Got it!
          </button>
        </div>
      </div>
    </div>
  );
}

