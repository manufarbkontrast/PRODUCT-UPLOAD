'use client';

import { TextareaHTMLAttributes, forwardRef } from 'react';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = '', label, error, id, ...props }, ref) => {
    const textareaId = id || props.name;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={textareaId} className="block text-sm font-medium mb-1 text-muted-foreground">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={`
            w-full px-3 py-2 text-base
            border rounded-lg
            bg-transparent
            border-input
            focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:border-ring
            placeholder:text-muted-foreground
            disabled:opacity-50 disabled:cursor-not-allowed
            resize-none
            ${error ? 'border-destructive focus-visible:ring-destructive/20' : ''}
            ${className}
          `}
          rows={3}
          {...props}
        />
        {error && (
          <p className="mt-1 text-sm text-destructive">{error}</p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
export default Textarea;
