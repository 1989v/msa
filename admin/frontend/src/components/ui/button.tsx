import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'destructive';
  size?: 'default' | 'sm' | 'icon';
  asChild?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', asChild, children, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50';
    const variants = {
      default: 'bg-zinc-100 text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700',
      outline: 'border border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800',
      ghost: 'hover:bg-zinc-100 dark:hover:bg-zinc-800',
      destructive: 'bg-red-600 text-white hover:bg-red-700',
    };
    const sizes = {
      default: 'h-9 px-4 py-2 text-sm',
      sm: 'h-8 px-3 text-xs',
      icon: 'h-9 w-9',
    };

    if (asChild) {
      const child = children as React.ReactElement;
      if (child && typeof child === 'object' && 'props' in child) {
        return <child.type {...child.props} className={cn(baseStyles, variants[variant], sizes[size], className, child.props.className)} ref={ref} />;
      }
    }

    return (
      <button className={cn(baseStyles, variants[variant], sizes[size], className)} ref={ref} {...props}>
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';
export { Button };
