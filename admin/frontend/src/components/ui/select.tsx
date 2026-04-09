import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'flex h-9 rounded-md border border-zinc-300 bg-transparent px-3 py-1 text-sm',
        'focus:outline-none focus:ring-1 focus:ring-zinc-400',
        'dark:border-zinc-700 dark:bg-zinc-900',
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
);
Select.displayName = 'Select';
export { Select };
