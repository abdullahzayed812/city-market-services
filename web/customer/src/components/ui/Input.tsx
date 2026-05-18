import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, iconRight, hint, className, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {icon && (
            <span className="absolute left-4 text-text-muted flex-shrink-0">{icon}</span>
          )}
          <input
            ref={ref}
            className={cn(
              'w-full bg-white border border-border rounded-xl h-14 px-4 text-sm font-medium text-text-primary',
              'placeholder:text-text-muted shadow-soft',
              'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
              'transition-all duration-150',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              icon && 'pl-11',
              iconRight && 'pr-11',
              error && 'border-error focus:ring-error/20 focus:border-error',
              className,
            )}
            {...props}
          />
          {iconRight && (
            <span className="absolute right-4 text-text-muted flex-shrink-0">{iconRight}</span>
          )}
        </div>
        {error && <p className="text-xs text-error font-medium">{error}</p>}
        {hint && !error && <p className="text-xs text-text-muted">{hint}</p>}
      </div>
    );
  },
);

Input.displayName = 'Input';
