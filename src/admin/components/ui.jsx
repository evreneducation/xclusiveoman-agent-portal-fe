// Small Tailwind-only building blocks mirroring the wireframe's visual language
// (.btn, .field, .wf-box, .badge, .tag classes in Xclusive-Oman-Wireframes.html).
import { motion } from 'framer-motion';
import { LuChevronLeft, LuChevronRight } from 'react-icons/lu';

// Button is now the shadcn/ui component (src/components/ui/button.jsx) —
// re-exported here so every existing `import { Button } from '../components/ui.jsx'`
// across the admin pages keeps working unchanged.
export { Button } from '../../components/ui/button.jsx';

// Colour system pass (whole-admin restyle) — every consumer of these
// primitives (Product/MICE Catalog, Bookings, Support, Marketing, Analytics,
// Reviews, Employees, …) picks up the new indigo/purple-accented palette
// automatically from this one file, rather than each page needing its own
// per-instance colour overrides. Semantics are unchanged (Badge's tone names
// still mean the same thing everywhere; Card/inputs still behave exactly as
// before) — only the actual hex values moved onto the palette the CMS pages
// introduced first.
export function FieldLabel({ children }) {
  return <div className="mb-1.5 text-[11px] font-semibold uppercase text-[#64748B]">{children}</div>;
}

export function TextInput({ className = '', ...props }) {
  return (
    <input
      className={`w-full rounded-md border border-[#D7DDF0] bg-[#FAFBFF] px-3.5 py-3 text-sm text-ink shadow-sm placeholder:text-[#94A3B8] focus:border-[#6366F1] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/15 ${className}`}
      {...props}
    />
  );
}

export function Textarea({ className = '', ...props }) {
  return (
    <textarea
      className={`w-full rounded-md border border-[#D7DDF0] bg-[#FAFBFF] px-3.5 py-3 text-sm text-ink shadow-sm placeholder:text-[#94A3B8] focus:border-[#6366F1] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/15 ${className}`}
      {...props}
    />
  );
}

export function Select({ className = '', children, ...props }) {
  return (
    <select
      className={`w-full rounded-md border border-[#D7DDF0] bg-[#FAFBFF] px-3.5 py-3 text-sm text-ink shadow-sm focus:border-[#6366F1] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/15 ${className}`}
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
      className={`relative rounded-lg border border-[#E4E9FB] bg-white/95 p-5 shadow-[0_4px_16px_rgba(15,23,42,0.05)] sm:p-6 ${className}`}
    >
      {label && (
        <div className="mb-3 text-[10px] font-semibold uppercase text-[#4F46E5]">
          {label}
        </div>
      )}
      {children}
    </motion.div>
  );
}

export function Tag({ active, className = '', children, ...props }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
        active
          ? 'border-transparent bg-gradient-to-r from-[#2563EB] to-[#4F46E5] text-white shadow-sm'
          : 'border-[#D7DDF0] bg-white text-[#475569] hover:border-[#6366F1] hover:text-[#4F46E5]'
      } ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}

export function Badge({ tone = 'grey', className = '', children }) {
  const tones = {
    green: 'bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]',
    amber: 'bg-[#FFF7ED] text-[#C2410C] border-[#FDBA74]',
    grey: 'bg-[#F1F3F9] text-[#64748B] border-[#D7DDF0]',
    red: 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]',
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function Note({ children }) {
  return (
    <span className="inline-flex rounded-full border border-accent/40 bg-accent-soft px-2.5 py-1 text-[10px] font-semibold text-accent">
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
    <label className="flex cursor-pointer items-center gap-2 py-1 text-xs text-ink">
      <span
        onClick={() => onChange?.(!checked)}
        className={`flex h-4 w-4 flex-none items-center justify-center rounded border-[1.5px] ${
          checked ? 'border-ink bg-ink text-white' : 'border-line-light bg-white'
        }`}
      >
        {checked ? '✓' : ''}
      </span>
      <span className="flex-1" onClick={() => onChange?.(!checked)}>
        {label}
      </span>
      {hint && <span className="text-muted">{hint}</span>}
    </label>
  );
}

// Each column is either a plain string (left-aligned, every existing
// caller's usage) or `{ label, align: 'right' }` for a column — typically
// a trailing "Actions" column — whose header should line up with
// right-aligned cell content instead.
export function Table({ columns, rows, renderRow }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-[#E4E9FB] shadow-[0_4px_16px_rgba(15,23,42,0.05)]">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="bg-[#F3F4FF]">
            {columns.map((c) => {
              const label = typeof c === 'string' ? c : c.label;
              const align = typeof c === 'string' ? 'left' : c.align || 'left';
              return (
                <th
                  key={label}
                  className={`whitespace-nowrap border-b border-[#E4E9FB] px-3 py-2 font-semibold uppercase text-[#4F46E5] ${
                    align === 'right' ? 'text-right' : 'text-left'
                  }`}
                >
                  {label}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>{rows.map(renderRow)}</tbody>
      </table>
    </div>
  );
}

// Prev/next + numbered pages, windowed to at most 5 numbers around the
// current one, plus a "Showing X to Y of Z {itemLabel}" count — shared by
// every backend-paginated admin list (Agent Approvals, Employees, …) rather
// than each page re-implementing its own pager.
export function Pagination({ page, totalPages, total, pageSize, onChange, itemLabel = 'items' }) {
  if (total === 0) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  const windowSize = 5;
  let first = Math.max(1, page - Math.floor(windowSize / 2));
  const last = Math.min(totalPages, first + windowSize - 1);
  first = Math.max(1, last - windowSize + 1);
  const pages = Array.from({ length: last - first + 1 }, (_, i) => first + i);

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <span className="text-xs text-muted">
        Showing {start} to {end} of {total} {itemLabel}
      </span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          aria-label="Previous page"
          className="flex h-8 w-8 items-center justify-center rounded-md border border-[#D7DDF0] bg-white text-[#475569] hover:border-[#6366F1] hover:text-[#4F46E5] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <LuChevronLeft size={16} />
        </button>
        {pages.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            className={`flex h-8 w-8 items-center justify-center rounded-md text-xs font-semibold ${
              p === page
                ? 'bg-gradient-to-r from-[#2563EB] to-[#4F46E5] text-white shadow-sm'
                : 'border border-[#D7DDF0] bg-white text-[#475569] hover:border-[#6366F1] hover:text-[#4F46E5]'
            }`}
          >
            {p}
          </button>
        ))}
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
          aria-label="Next page"
          className="flex h-8 w-8 items-center justify-center rounded-md border border-[#D7DDF0] bg-white text-[#475569] hover:border-[#6366F1] hover:text-[#4F46E5] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <LuChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
