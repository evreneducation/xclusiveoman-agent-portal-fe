// Outline pill button with the arrow in its own circle overlapping the
// pill's right edge — one continuous shape, not two separate pieces with a
// gap between them (an earlier version split them apart; the reference
// actually shows the arrow circle bulging slightly past the pill's own
// top/bottom edges, merged into one outline via the overlap + matching
// white fill/gold border on both). One outer div (the pill) + one inner div
// (the arrow circle), per the reference. Shared by SignatureToursSection's
// "See More Packages" and ActivitiesSection's "See More Activities & Day
// Tours" buttons.
import { FiArrowRight } from 'react-icons/fi';

export function ArrowPillButton({ href = '/login', children }) {
  return (
    <a
      href={href}
      className="group relative inline-flex items-center rounded-full border border-[#E8B84B] bg-white py-3.5 pl-8 pr-16 text-base font-semibold text-[#1B1B1B] shadow-[0_6px_16px_rgba(27,27,27,0.06)] transition-colors hover:bg-[#FBF3E1]"
    >
      {children}
      <span className="absolute -right-3 top-1/2 flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full border border-[#E8B84B] bg-white transition-transform group-hover:translate-x-0.5">
        <FiArrowRight />
      </span>
    </a>
  );
}
