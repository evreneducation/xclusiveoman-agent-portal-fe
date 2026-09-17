// Outline pill button ("See More Packages" / "See More Activities & Day
// Tours") — ONE continuous pill (single border, no divider, no separate
// circular button/background around the icon). The right-side icon is
// react-icons' LuArrowRight for the arrow itself, framed by a CSS-drawn
// arc: a plain circular border with one side made transparent then rotated,
// not a full CircleArrow icon (the reference's arc isn't a closed circle).
// Shared by SignatureToursSection, ActivitiesSection and CtaSection — the
// latter two's longer copy ("See More Activities & Day Tours", "Sign Up For
// Trade Access / Log In") wrapped to two cramped lines at mobile widths
// against the fixed lg-sized padding/gap/circle, so those scale down below
// sm and step back up to the original sizes from sm: onward (md/lg
// unchanged either way, since they were already sm: and up).
import { LuArrowRight } from 'react-icons/lu';

export function ArrowPillButton({ href = '/agent', children }) {
  return (
    <a
      href={href}
      className="inline-flex items-center justify-between gap-3 rounded-full border border-[#E8B84B] bg-[#FFFCF5] py-2.5 pl-5 pr-2 text-sm font-medium text-[#1B1B1B] shadow-[0_14px_32px_rgba(232,184,75,0.34)] transition-colors hover:bg-[#FBF3E1] sm:gap-6 sm:py-3.5 sm:pl-8 sm:pr-3 sm:text-base"
    >
      <span>{children}</span>
      <span
        className="relative flex h-8 w-8 flex-shrink-0 items-center justify-center sm:h-11 sm:w-11"
        aria-hidden="true"
      >
        {/* Circular arc — a rounded border with its top side transparent,
            rotated -45deg so the gap opens toward the upper-left, framing
            the arrow rather than closing into a full circle. */}
        <span className="absolute inset-0 rounded-full border-[3px] border-[#1B1B1B] border-t-transparent -rotate-45" />
        <LuArrowRight className="relative h-4 w-4 text-[#1B1B1B] sm:h-6 sm:w-6" strokeWidth={3} />
      </span>
    </a>
  );
}
