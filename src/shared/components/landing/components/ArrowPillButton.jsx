// Outline pill button ("See More Packages" / "See More Activities & Day
// Tours") — ONE continuous pill (single border, no divider, no separate
// circular button/background around the icon). The right-side icon is
// react-icons' LuArrowRight for the arrow itself, framed by a CSS-drawn
// arc: a plain circular border with one side made transparent then rotated,
// not a full CircleArrow icon (the reference's arc isn't a closed circle).
// Shared by SignatureToursSection and ActivitiesSection.
import { LuArrowRight } from 'react-icons/lu';

export function ArrowPillButton({ href = '/agent', children }) {
  return (
    <a
      href={href}
      className="inline-flex items-center justify-between gap-6 rounded-full border border-[#E8B84B] bg-[#FFFCF5] py-3.5 pl-8 pr-3 text-base font-medium text-[#1B1B1B] shadow-[0_14px_32px_rgba(232,184,75,0.34)] transition-colors hover:bg-[#FBF3E1]"
    >
      <span>{children}</span>
      <span className="relative flex h-11 w-11 flex-shrink-0 items-center justify-center" aria-hidden="true">
        {/* Circular arc — a rounded border with its top side transparent,
            rotated -45deg so the gap opens toward the upper-left, framing
            the arrow rather than closing into a full circle. */}
        <span className="absolute inset-0 rounded-full border-[3px] border-[#1B1B1B] border-t-transparent -rotate-45" />
        <LuArrowRight className="relative h-6 w-6 text-[#1B1B1B]" strokeWidth={3} />
      </span>
    </a>
  );
}
