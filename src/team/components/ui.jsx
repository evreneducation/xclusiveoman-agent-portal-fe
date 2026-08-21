// Small Tailwind-only building blocks for the Team Portal (/team — Lead
// Managers/Relationship Managers) — mirrors agent/components/ui.jsx's own
// shape (which itself mirrors admin/components/ui.jsx), themed on the
// `team-*` token set (tailwind.config.js) so this portal reads as its own,
// third distinct app rather than admin's blue/indigo or agent's teal/gold.
import { motion } from 'framer-motion';

export function Button({ variant = 'default', className = '', ...props }) {
  const base =
    'inline-flex items-center justify-center rounded-md border px-4 py-2 text-xs font-semibold shadow-sm transition duration-150 focus:outline-none focus:ring-2 focus:ring-team-accent/25 disabled:cursor-not-allowed disabled:opacity-50';
  const variants = {
    default: 'border-team-line-light bg-white text-team-ink hover:border-team-accent hover:bg-team-panel',
    solid: 'border-transparent bg-team-ink-dark text-white shadow-md shadow-black/10 hover:bg-team-ink',
    accent:
      'border-transparent bg-gradient-to-r from-[#BE123C] to-[#E11D48] text-white shadow-md shadow-[#BE123C]/25 hover:border-transparent hover:opacity-90',
    danger: 'border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C] hover:border-[#EF4444] hover:bg-[#FEE2E2]',
  };
  return (
    <motion.button
      whileHover={props.disabled ? undefined : { scale: 1.015 }}
      whileTap={props.disabled ? undefined : { scale: 0.985 }}
      transition={{ duration: 0.12 }}
      className={`${base} ${variants[variant]} ${className}`}
      {...props}
    />
  );
}

export function FieldLabel({ children }) {
  return <div className="mb-1.5 text-[11px] font-semibold uppercase text-team-muted">{children}</div>;
}

export function TextInput({ className = '', ...props }) {
  return (
    <input
      className={`w-full rounded-md border border-team-line-light bg-white px-3 py-2.5 text-sm text-team-ink shadow-sm placeholder:text-team-muted focus:border-team-accent focus:outline-none focus:ring-2 focus:ring-team-accent/15 ${className}`}
      {...props}
    />
  );
}

export function Textarea({ className = '', ...props }) {
  return (
    <textarea
      className={`w-full rounded-md border border-team-line-light bg-white px-3 py-2.5 text-sm text-team-ink shadow-sm placeholder:text-team-muted focus:border-team-accent focus:outline-none focus:ring-2 focus:ring-team-accent/15 ${className}`}
      {...props}
    />
  );
}

export function Select({ className = '', children, ...props }) {
  return (
    <select
      className={`w-full rounded-md border border-team-line-light bg-white px-3 py-2.5 text-sm text-team-ink shadow-sm focus:border-team-accent focus:outline-none focus:ring-2 focus:ring-team-accent/15 ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}

export function Card({ label, className = '', children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={`relative rounded-lg border border-team-line-light bg-white/95 p-4 shadow-[0_4px_16px_rgba(30,37,50,0.06)] ${className}`}
    >
      {label && <div className="mb-3 text-[10px] font-semibold uppercase text-team-accent-dark">{label}</div>}
      {children}
    </motion.div>
  );
}

export function Badge({ tone = 'grey', className = '', children }) {
  const tones = {
    green: 'bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]',
    amber: 'bg-[#FFF7ED] text-[#C2410C] border-[#FDBA74]',
    grey: 'bg-team-panel text-team-muted border-team-line-light',
    red: 'bg-team-accent-soft text-team-accent-dark border-team-accent/40',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function ErrorText({ children }) {
  if (!children) return null;
  return <p className="rounded-md border border-[#f2bdc6] bg-[#fff7f8] px-3 py-2 text-xs text-[#a5162d]">{children}</p>;
}

export function Table({ columns, rows, renderRow }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-team-line-light shadow-[0_4px_16px_rgba(30,37,50,0.06)]">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="bg-team-panel">
            {columns.map((c) => (
              <th key={c} className="border-b border-team-line-light px-3 py-2 font-semibold uppercase text-team-accent-dark">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{rows.map(renderRow)}</tbody>
      </table>
    </div>
  );
}

export function EmptyState({ icon: Icon, children }) {
  return (
    <div className="rounded-lg border border-dashed border-team-line-light bg-team-panel/60 px-4 py-10 text-center">
      {Icon && (
        <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-white text-team-line shadow-sm">
          <Icon size={20} />
        </span>
      )}
      <p className="text-xs text-team-muted">{children}</p>
    </div>
  );
}

// Consistent icon + title (+ live count) + subtitle header, used at the top
// of every list page instead of each one hand-rolling its own bare <h2>/<p>
// pair with no visual anchor.
export function PageHeader({ icon: Icon, title, subtitle, count }) {
  return (
    <div className="mb-6 flex items-start gap-3.5">
      {Icon && (
        <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-gradient-to-br from-team-accent to-[#E11D48] text-white shadow-md shadow-team-accent/25">
          <Icon size={20} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-2xl font-bold text-team-ink">{title}</h2>
          {count != null && (
            <span className="rounded-full bg-team-panel px-2.5 py-0.5 text-xs font-semibold text-team-muted">
              {count}
            </span>
          )}
        </div>
        {subtitle && <p className="mt-1 text-sm text-team-muted">{subtitle}</p>}
      </div>
    </div>
  );
}

// A handful of pulsing skeleton cards instead of bare "Loading…" text —
// `rows` controls how many placeholders (roughly matching how many real
// cards the page would show on a first load). `variant="list"` stacks them
// full-width instead of gridding them, for pages that render a vertical
// list of full-width rows (e.g. Support Tickets) rather than a card grid.
export function LoadingState({ rows = 3, variant = 'grid' }) {
  const placeholder = (i) => (
    <div key={i} className="animate-pulse rounded-lg border border-team-line-light bg-white p-4">
      <div className="h-3 w-2/3 rounded bg-team-panel" />
      <div className="mt-2.5 h-2.5 w-1/2 rounded bg-team-panel" />
      <div className="mt-4 h-2.5 w-1/3 rounded bg-team-panel" />
    </div>
  );
  if (variant === 'list') {
    return <div className="space-y-3">{Array.from({ length: rows }, (_, i) => placeholder(i))}</div>;
  }
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: rows }, (_, i) => placeholder(i))}</div>;
}
