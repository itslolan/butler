'use client';

import { forwardRef } from 'react';

interface CalculatorInputProps {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: 'text' | 'number' | 'currency' | 'percentage';
  placeholder?: string;
  prefix?: string;
  suffix?: string;
  min?: number;
  max?: number;
  step?: number;
  helpText?: string;
}

const CalculatorInput = forwardRef<HTMLInputElement, CalculatorInputProps>(
  ({ label, value, onChange, type = 'number', placeholder, prefix, suffix, min, max, step, helpText }, ref) => {
    const inputType = type === 'currency' || type === 'percentage' ? 'number' : type;
    const inputPrefix = type === 'currency' ? '$' : prefix;
    const inputSuffix = type === 'percentage' ? '%' : suffix;

    return (
      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}
        </label>
        <div className="relative">
          {inputPrefix && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-slate-500 dark:text-slate-400 sm:text-sm">{inputPrefix}</span>
            </div>
          )}
          <input
            ref={ref}
            type={inputType}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            min={min}
            max={max}
            step={step || (type === 'percentage' ? 0.1 : type === 'currency' ? 0.01 : 1)}
            className={`
              block w-full rounded-lg border border-slate-300 dark:border-slate-700 
              bg-white dark:bg-gray-800 
              text-slate-900 dark:text-white 
              placeholder:text-slate-400 dark:placeholder:text-slate-500
              focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent
              transition-colors
              ${inputPrefix ? 'pl-7' : 'pl-3'}
              ${inputSuffix ? 'pr-8' : 'pr-3'}
              py-2.5 text-sm
            `}
          />
          {inputSuffix && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <span className="text-slate-500 dark:text-slate-400 sm:text-sm">{inputSuffix}</span>
            </div>
          )}
        </div>
        {helpText && (
          <p className="text-xs text-slate-500 dark:text-slate-400">{helpText}</p>
        )}
      </div>
    );
  }
);

CalculatorInput.displayName = 'CalculatorInput';

export default CalculatorInput;


