// Small Tailwind-only building blocks mirroring the wireframe's visual language
// (.btn, .field, .wf-box, .badge, .tag classes in Xclusive-Oman-Wireframes.html).

export function Button({ variant = 'default', className = '', ...props }) {
  const base = 'inline-flex items-center justify-center rounded-md border px-4 py-2 text-xs font-semibold shadow-sm transition duration-150 focus:outline-none focus:ring-2 focus:ring-accent/25 disabled:cursor-not-allowed disabled:opacity-50';
  const variants = {
    default: 'border-line-light bg-white text-ink hover:border-ink hover:bg-panel',
    solid: 'border-ink bg-ink text-white hover:bg-[#171717]',
    accent: 'border-accent bg-accent text-white hover:bg-[#9f4224]',
    danger: 'border-[#d9a0aa] bg-[#fff7f8] text-[#a5162d] hover:border-[#a5162d] hover:bg-[#fdecef]',
  };
  return <button className={`${base} ${variants[variant]} ${className}`} {...props} />;
}

export function FieldLabel({ children }) {
  return <div className="mb-1.5 text-[11px] font-semibold uppercase text-muted">{children}</div>;
}

export function TextInput({ className = '', ...props }) {
  return (
    <input
      className={`w-full rounded-md border border-line-light bg-white px-3 py-2.5 text-sm text-ink shadow-sm placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15 ${className}`}
      {...props}
    />
  );
}

export function Select({ className = '', children, ...props }) {
  return (
    <select
      className={`w-full rounded-md border border-line-light bg-white px-3 py-2.5 text-sm text-ink shadow-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15 ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}

export function Card({ label, className = '', children }) {
  return (
    <div className={`relative rounded-lg border border-line-light bg-white/95 p-4 shadow-sm ${className}`}>
      {label && (
        <div className="mb-3 text-[10px] font-semibold uppercase text-muted">
          {label}
        </div>
      )}
      {children}
    </div>
  );
}

export function Tag({ active, className = '', children, ...props }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
        active ? 'border-ink bg-ink text-white shadow-sm' : 'border-line-light bg-white text-[#666] hover:border-line hover:text-ink'
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
    amber: 'bg-[#fff2dc] text-[#9a5a16] border-[#f1c67f]',
    grey: 'bg-[#f1f3f5] text-[#626a73] border-[#d7dde2]',
    red: 'bg-[#fdecef] text-[#a5162d] border-[#f2bdc6]',
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

export function Table({ columns, rows, renderRow }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line-light">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="bg-panel">
            {columns.map((c) => (
              <th key={c} className="border-b border-line-light px-3 py-2 font-semibold uppercase text-muted">
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
