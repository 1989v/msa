import { cn } from '@/lib/utils';

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900', className)} {...props} />;
}
