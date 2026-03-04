import { type InputHTMLAttributes, forwardRef } from 'react';

const inputClass =
  'mt-1 block w-full rounded-md border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';
const errorInputClass =
  'mt-1 block w-full rounded-md border border-red-400 bg-[var(--background)] px-3 py-2 text-sm shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500';

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export const FormField = forwardRef<HTMLInputElement, FormFieldProps>(
  function FormField({ label, error, hint, className, ...rest }, ref) {
    return (
      <div className={className}>
        <label className="block text-sm font-medium">{label}</label>
        <input ref={ref} {...rest} className={error ? errorInputClass : inputClass} />
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        {!error && hint && (
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">{hint}</p>
        )}
      </div>
    );
  },
);

interface FormTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
}

export const FormTextarea = forwardRef<HTMLTextAreaElement, FormTextareaProps>(
  function FormTextarea({ label, error, className, ...rest }, ref) {
    return (
      <div className={className}>
        <label className="block text-sm font-medium">{label}</label>
        <textarea
          ref={ref}
          {...rest}
          className={error ? errorInputClass : inputClass}
        />
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
    );
  },
);

interface FormCheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export const FormCheckbox = forwardRef<HTMLInputElement, FormCheckboxProps>(
  function FormCheckbox({ label, error, className, ...rest }, ref) {
    return (
      <label className={`flex items-center gap-2 text-sm ${className ?? ''}`}>
        <input
          ref={ref}
          type="checkbox"
          {...rest}
          className="rounded border-[var(--input)]"
        />
        {label}
        {error && <span className="text-xs text-red-600">{error}</span>}
      </label>
    );
  },
);
