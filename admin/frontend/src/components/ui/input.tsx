import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'flex h-9 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-1 text-sm transition-colors',
        'placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400',
        'dark:border-zinc-700 dark:focus:ring-zinc-500',
        className
      )}
      {...props}
    />
  )
);
Input.displayName = 'Input';
export { Input };
