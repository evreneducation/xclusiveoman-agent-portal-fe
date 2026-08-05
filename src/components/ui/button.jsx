// shadcn/ui-style Button (cva variants + Radix Slot for asChild), themed on
// the Admin Console's existing Tailwind tokens (ink/accent/line-light/panel)
// so the migration from the old hand-rolled Button is visual no-op — same
// variant names (default/solid/accent/danger), same look, new component lib
// underneath. src/admin/components/ui.jsx re-exports this as `Button` so
// every existing admin page's `import { Button } from '../components/ui.jsx'`
// keeps working unchanged.
import { forwardRef } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils.js';

export const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md border font-semibold shadow-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'border-line-light bg-white text-ink hover:border-ink hover:bg-panel',
        solid: 'border-ink bg-ink text-white hover:bg-ink-dark',
        accent: 'border-accent bg-accent text-white hover:bg-[#b3521f]',
        danger: 'border-[#d9a0aa] bg-[#fff7f8] text-[#a5162d] hover:border-[#a5162d] hover:bg-[#fdecef]',
      },
      size: {
        default: 'px-5 py-2.5 text-xs',
        sm: 'px-3.5 py-1.5 text-[11px]',
        lg: 'px-6 py-3 text-sm',
        icon: 'h-9 w-9 p-0 text-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export const Button = forwardRef(({ className, variant, size, asChild = false, disabled, ...props }, ref) => {
  // Slot renders shadcn's `asChild` pattern (e.g. <Button asChild><Link .../></Button>);
  // motion.button keeps the existing hover/tap micro-interaction for the
  // normal (non-asChild) case, matching the previous component's feel.
  if (asChild) {
    return (
      <Slot ref={ref} disabled={disabled} className={cn(buttonVariants({ variant, size }), className)} {...props} />
    );
  }

  return (
    <motion.button
      ref={ref}
      whileHover={disabled ? undefined : { scale: 1.015 }}
      whileTap={disabled ? undefined : { scale: 0.985 }}
      transition={{ duration: 0.12 }}
      disabled={disabled}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
});
Button.displayName = 'Button';
