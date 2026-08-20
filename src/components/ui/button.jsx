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

// Colour system pass (whole-admin restyle): 'accent' — the primary-action
// variant used on Save/Submit/+New buttons across virtually every admin
// page — now uses the blue→indigo gradient the CMS pages introduced first,
// so every page's primary action reads consistently rather than CMS being
// the only colourful corner of the console. 'default'/'danger' are tinted
// to the same palette (indigo-grey / danger red) without changing which
// variant any page already picks. 'solid' (ink navy) was already close to
// the new palette's navy tones, so it only gets a touch more shadow.
export const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md border font-semibold shadow-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1]/30 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'border-[#D7DDF0] bg-white text-[#334155] hover:border-[#6366F1] hover:bg-[#F8FAFF] hover:text-[#4F46E5]',
        solid: 'border-transparent bg-[#172554] text-white shadow-md shadow-black/10 hover:bg-[#0F1B4D]',
        accent:
          'border-transparent bg-gradient-to-r from-[#2563EB] to-[#4F46E5] text-white shadow-md shadow-[#2563EB]/20 hover:border-transparent hover:opacity-90',
        danger: 'border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C] hover:border-[#EF4444] hover:bg-[#FEE2E2]',
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
