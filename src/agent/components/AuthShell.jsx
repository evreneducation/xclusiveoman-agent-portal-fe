import { FiCheckCircle } from 'react-icons/fi';

// Re-themed to match shared/components/LoginModal.jsx's own design system
// byte-for-byte (colours, hero panel, card treatment, input style) rather
// than the agent portal's usual teal/gold identity — Sign In and Sign Up
// are the same "pre-auth, portal-agnostic" moment LoginModal itself already
// argues for in its own top comment, so a visitor bouncing between the two
// (the Sign In screen's own "Sign up" link, and this page's "Sign in" link
// below) shouldn't be able to tell they've left one design system for
// another. LoginModal itself is intentionally NOT imported from here or
// touched by this file — it's shared across three entry points ("/",
// /admin/login, /agent/login), and duplicating its small, purely
// presentational bits (colour hexes, hero copy, the input style) here is a
// safer trade than adding this page as a fourth consumer of that file.
export const AUTH_INK = '#16233f';
export const AUTH_ACCENT = '#d1642f';
export const AUTH_ACCENT_WARM = '#e8935f';

const HERO_IMAGE_SRC = '/oman_pic.jpg';
const HERO_HEADLINE = 'Your trade gateway to exclusive Oman experiences';
const HERO_SUBTEXT =
  "From Muscat's coastline to the dunes of the interior, Oman rewards the traveller who goes looking for it — and Xclusive Oman is how you sell that experience. Fixed group departures, bespoke FIT itineraries, and full MICE proposals, priced and booked in one place.";
const HERO_FEATURES = [
  'Transparent, tiered net rates on Fixed Group Departures — see your price instantly',
  'Curate personalised FIT itineraries for your clients, built day by day',
  'End-to-end MICE proposals backed by real supplier quotes',
  'A dedicated Relationship Manager for every agency, every step of the way',
];

const INPUT_FOCUS_CLASSES = 'focus:border-[#d1642f] focus:outline-none focus:ring-2 focus:ring-[#d1642f33]';

// Same look as LoginModal's own local LoginTextInput/label pairing —
// exported so Register.jsx's fields render with the identical border,
// focus ring, and label treatment as the email field on the Sign In screen.
export function AuthFieldLabel({ children }) {
  return <label className="mb-1.5 block text-[11px] font-semibold uppercase text-slate-500">{children}</label>;
}

export function AuthTextInput({ icon: Icon, className = '', ...props }) {
  return (
    <div className="relative">
      {Icon && <Icon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />}
      <input
        className={`w-full rounded-md border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 ${INPUT_FOCUS_CLASSES} ${
          Icon ? 'pl-9' : ''
        } ${className}`}
        {...props}
      />
    </div>
  );
}

export function AuthSelect({ className = '', children, ...props }) {
  return (
    <select
      className={`w-full rounded-md border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 shadow-sm ${INPUT_FOCUS_CLASSES} ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}

// Same gradient CTA as LoginModal's own submit button.
export function AuthButton({ className = '', ...props }) {
  return (
    <button
      className={`w-full rounded-md py-3 text-center text-sm font-semibold text-white shadow-lg shadow-[#d1642f]/25 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      style={{ background: `linear-gradient(135deg, ${AUTH_ACCENT_WARM}, ${AUTH_ACCENT})` }}
      {...props}
    />
  );
}

/**
 * Same outer structure as LoginModal: a full-bleed dark hero panel (real
 * photo, gradient overlay, headline/features) on the left at lg+, a warm
 * peachy gradient panel on the right holding a gradient-text heading above
 * a white card (top accent bar, same border/shadow) below it. `children`
 * renders inside that card — the form, its submit button, and the
 * "Already registered? Sign in" link, matching where LoginModal puts its
 * own form/submit/"Sign up" link.
 */
export default function AuthShell({
  eyebrow,
  title,
  subtitle,
  tagline = 'Your trade gateway to exclusive Oman experiences',
  footerNote,
  maxWidthClassName = 'max-w-[400px]',
  children,
}) {
  return (
    <div className="flex min-h-screen bg-[#0b1424]">
      <div className="relative hidden w-[46%] flex-none overflow-hidden lg:block">
        <img src={HERO_IMAGE_SRC} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b1424] via-[#0b1424]/80 to-[#0b1424]/30" />
        <div className="absolute inset-0 bg-[#0b1424]/10" />

        <div className="relative z-10 flex h-full flex-col justify-between p-12 xl:p-16">
          <img src="/Xclusive_Oman_Logo_2.png" alt="Xclusive Oman" className="h-11 w-auto object-contain" />

          <div>
            <div
              style={{ background: `linear-gradient(90deg, ${AUTH_ACCENT_WARM}, ${AUTH_ACCENT})` }}
              className="mb-4 h-1 w-14 rounded-full"
            />
            <h1 className="max-w-md text-[2.15rem] font-bold leading-[1.15] text-white xl:text-4xl">{HERO_HEADLINE}</h1>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-white/75">{HERO_SUBTEXT}</p>

            <ul className="mt-8 space-y-3">
              {HERO_FEATURES.map((feature) => (
                <li key={feature} className="flex items-start gap-2.5 text-sm text-white/90">
                  <FiCheckCircle className="mt-0.5 flex-none text-[#e8935f]" size={16} />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-white/40">Xclusive Oman by Traveon — B2B &amp; MICE Booking Portal</p>
        </div>
      </div>

      <div
        style={{ background: 'linear-gradient(135deg, #FFF8F3 0%, #FFF4EC 50%, #FFEEE5 100%)' }}
        className="relative flex flex-1 items-center justify-center overflow-y-auto px-4 py-10"
      >
        <div className={`w-full ${maxWidthClassName}`}>
          <div className="mb-8 text-center lg:hidden">
            <img src="/Xclusive_Oman_Logo_2.png" alt="Xclusive Oman" className="mx-auto mb-4 h-14 w-auto object-contain" />
            <p className="text-sm text-slate-500">{tagline}</p>
          </div>

          <div className="hidden lg:block lg:mb-8">
            {eyebrow && <p className="mb-1.5 text-xs font-bold uppercase tracking-[0.2em] text-[#d1642f]">{eyebrow}</p>}
            <h2
              style={{
                backgroundImage: `linear-gradient(90deg, ${AUTH_INK}, ${AUTH_ACCENT}, ${AUTH_ACCENT_WARM})`,
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
              }}
              className="text-2xl font-bold"
            >
              {title}
            </h2>
            {subtitle && <p className="mt-1.5 text-sm text-slate-500">{subtitle}</p>}
          </div>

          <div className="relative overflow-hidden rounded-xl border border-white bg-white p-6 shadow-xl shadow-[#d1642f]/[0.08] sm:p-7">
            <div
              style={{ background: `linear-gradient(90deg, ${AUTH_ACCENT_WARM}, ${AUTH_ACCENT})` }}
              className="absolute inset-x-0 top-0 h-1"
            />
            {children}
          </div>

          {footerNote && <div className="mt-5 text-center text-xs text-slate-500">{footerNote}</div>}
        </div>
      </div>
    </div>
  );
}
