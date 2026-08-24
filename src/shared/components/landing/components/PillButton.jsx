// Shared pill-shaped CTA button for the LandingPage — 'solid' (gold fill,
// used for primary actions like "Apply for Trade Access") and 'outline'
// (transparent, used for secondary actions like "View Sample Itineraries").
// Renders a <Link> when `to` is given, otherwise a plain <button> (e.g. for
// "See More Packages" placeholders that don't have a real destination yet).
import { Link } from 'react-router-dom';
import { FiArrowRight } from 'react-icons/fi';
import { cn } from '../../../../lib/utils.js';

const VARIANTS = {
  solid: 'border border-transparent bg-[#C9A24A] text-[#1B2333] hover:bg-[#B38A34]',
  outline: 'border border-[#1B2333]/25 bg-transparent text-[#1B2333] hover:border-[#1B2333]',
};

export function PillButton({ to, onClick, variant = 'solid', withArrow = true, className, children, ...props }) {
  const classes = cn(
    'inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold tracking-wide transition-colors duration-150',
    VARIANTS[variant],
    className
  );

  const content = (
    <>
      {children}
      {withArrow && <FiArrowRight className="text-base" />}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={classes} {...props}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={classes} {...props}>
      {content}
    </button>
  );
}
