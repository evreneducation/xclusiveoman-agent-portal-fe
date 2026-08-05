// Small Tailwind-only building blocks for the Agent Portal — mirrors the
// shape of admin/components/ui.jsx but themed on the `agent-*` token set
// (tailwind.config.js) so the two portals read as visually distinct apps
// while sharing the same component surface/API.
import { motion } from 'framer-motion';

export function Button({ variant = 'default', className = '', ...props }) {
  const base =
    'inline-flex items-center justify-center rounded-md border px-4 py-2 text-xs font-semibold shadow-sm transition duration-150 focus:outline-none focus:ring-2 focus:ring-agent-accent/25 disabled:cursor-not-allowed disabled:opacity-50';
  const variants = {
    default: 'border-agent-line-light bg-white text-agent-ink hover:border-agent-ink hover:bg-agent-panel',
    solid: 'border-agent-ink bg-agent-ink text-white hover:bg-agent-ink-dark',
    accent: 'border-agent-accent bg-agent-accent text-white hover:bg-agent-accent-dark',
    danger: 'border-[#d9a0aa] bg-[#fff7f8] text-[#a5162d] hover:border-[#a5162d] hover:bg-[#fdecef]',
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
  return <div className="mb-1.5 text-[11px] font-semibold uppercase text-agent-muted">{children}</div>;
}

export function TextInput({ className = '', ...props }) {
  return (
    <input
      className={`w-full rounded-md border border-agent-line-light bg-white px-3 py-2.5 text-sm text-agent-ink shadow-sm placeholder:text-agent-muted focus:border-agent-accent focus:outline-none focus:ring-2 focus:ring-agent-accent/15 ${className}`}
      {...props}
    />
  );
}

export function Select({ className = '', children, ...props }) {
  return (
    <select
      className={`w-full rounded-md border border-agent-line-light bg-white px-3 py-2.5 text-sm text-agent-ink shadow-sm focus:border-agent-accent focus:outline-none focus:ring-2 focus:ring-agent-accent/15 ${className}`}
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
      className={`relative rounded-lg border border-agent-line-light bg-white/95 p-4 shadow-sm ${className}`}
    >
      {label && <div className="mb-3 text-[10px] font-semibold uppercase text-agent-muted">{label}</div>}
      {children}
    </motion.div>
  );
}

export function Tag({ active, className = '', children, ...props }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
        active
          ? 'border-agent-ink bg-agent-ink text-white shadow-sm'
          : 'border-agent-line-light bg-white text-[#5a6d6a] hover:border-agent-line hover:text-agent-ink'
      } ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}

export function Badge({ tone = 'grey', className = '', children }) {
  const tones = {
    green: 'bg-[#e9f7ef] text-[#227647] border-[#b9e2c9]',
    amber: 'bg-agent-accent-soft text-agent-accent-dark border-agent-accent/40',
    grey: 'bg-agent-panel text-agent-muted border-agent-line-light',
    red: 'bg-[#fdecef] text-[#a5162d] border-[#f2bdc6]',
    teal: 'bg-agent-panel text-agent-ink border-agent-line',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function Note({ children }) {
  return (
    <span className="inline-flex rounded-full border border-agent-accent/40 bg-agent-accent-soft px-2.5 py-1 text-[10px] font-semibold text-agent-accent-dark">
      {children}
    </span>
  );
}

export function ErrorText({ children }) {
  if (!children) return null;
  return <p className="rounded-md border border-[#f2bdc6] bg-[#fff7f8] px-3 py-2 text-xs text-[#a5162d]">{children}</p>;
}

export function Checkbox({ checked, onChange, label, hint }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 py-1 text-xs text-agent-ink">
      <span
        onClick={() => onChange?.(!checked)}
        className={`flex h-4 w-4 flex-none items-center justify-center rounded border-[1.5px] ${
          checked ? 'border-agent-ink bg-agent-ink text-white' : 'border-agent-line-light bg-white'
        }`}
      >
        {checked ? '✓' : ''}
      </span>
      <span className="flex-1" onClick={() => onChange?.(!checked)}>
        {label}
      </span>
      {hint && <span className="text-agent-muted">{hint}</span>}
    </label>
  );
}

export function Table({ columns, rows, renderRow }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-agent-line-light">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="bg-agent-panel">
            {columns.map((c) => (
              <th key={c} className="border-b border-agent-line-light px-3 py-2 font-semibold uppercase text-agent-muted">
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

export function StarRating({ rating = 0, reviewCount, size = 'text-xs' }) {
  const full = Math.round(rating);
  return (
    <span className={`inline-flex items-center gap-1 ${size}`}>
      <span className="tracking-tight text-agent-accent-dark">
        {'★'.repeat(full)}
        <span className="text-agent-line-light">{'★'.repeat(Math.max(0, 5 - full))}</span>
      </span>
      <span className="text-agent-muted">
        {rating?.toFixed ? rating.toFixed(1) : rating}
        {reviewCount != null ? ` (${reviewCount})` : ''}
      </span>
    </span>
  );
}
