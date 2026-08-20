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

export function EmptyState({ children }) {
  return (
    <p className="rounded-lg border border-team-line-light bg-team-panel px-4 py-6 text-center text-xs text-team-muted">
      {children}
    </p>
  );
}
