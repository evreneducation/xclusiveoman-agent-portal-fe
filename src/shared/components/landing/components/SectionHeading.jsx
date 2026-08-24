// Shared two-line section title used by every content section (Signature
// Tours, Activities, Transfers, We Operate...): a bold sans line plus an
// italic serif accent line/word in gold, both centered. Sections pass their
// own text as children so the accent word can sit anywhere in the line.
import { cn } from '../../../../lib/utils.js';

export function SectionHeading({ eyebrow, children, className }) {
  return (
    <div className={cn('text-center', className)}>
      {eyebrow && <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-[#C9A24A]">{eyebrow}</p>}
      <h2 className="text-3xl font-bold leading-tight text-[#1B2333] sm:text-4xl">{children}</h2>
    </div>
  );
}

// The gold, italic-serif accent word/phrase used inside SectionHeading, e.g.
// <SectionHeading>Signature Oman Tours, <Accent>Ready to Quote</Accent></SectionHeading>
export function Accent({ children }) {
  return <span className="font-serif italic text-[#C9A24A]">{children}</span>;
}
