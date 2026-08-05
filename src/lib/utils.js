import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Standard shadcn/ui className helper — merges conditional class lists (clsx)
// then resolves conflicting Tailwind utilities (twMerge), so e.g. a caller's
// `className="p-0"` reliably overrides a component's own `p-4` default.
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
