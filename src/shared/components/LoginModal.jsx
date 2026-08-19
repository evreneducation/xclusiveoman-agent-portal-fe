// Single, shared login screen for both the Admin Console and the Agent
// Portal — replaces what used to be two separate, hand-built forms
// (admin/pages/Login.jsx, agent/pages/Login.jsx), and is also what the app
// root ("/") renders directly (App.jsx). Renders byte-for-byte identically
// everywhere it's used — same tagline, same fields, same Sign up link, same
// footer note — on purpose: nobody visiting any of the three entry points is
// asked to declare "I'm staff" or "I'm an agent" first, so there is nothing
// left here that could differ before that's known. The only thing that ever
// varies per call site is where a successful login *lands* afterward
// (adminDestination/agentDestination below) — which is invisible until
// after that decision is already made. Portal-agnostic by the same rule
// NotificationBell.jsx already established for this directory: no
// `agent-*`/admin `ink` Tailwind tokens, no import from either portal's own
// components/ui.jsx.
//
// Email OTP login (replaces password): step 1 collects just the email and
// calls POST /auth/request-otp; step 2 (rendered inline, below the email
// field, once step 1 succeeds) collects the 6-digit code emailed to that
// address and calls POST /auth/verify-otp, which returns the exact same
// {accessToken, user} shape the old password POST /auth/login did — so
// everything below that point (isStaffUser/hard-navigation) is unchanged.
// Password-based login (POST /auth/login) still exists server-side
// (auth.controller.js) but nothing here calls it anymore; "Forgot password?"
// was removed from this form for the same reason — there's no password
// field on this screen anymore to reset. Sign up is untouched — an
// agency's own password (set at registration) is unrelated to how an
// already-registered user later signs back in here.
//
// The actual OTP calls also intentionally do NOT go through either portal's
// own AuthContext#login() — this is the one part of the app that doesn't
// yet know which portal the signed-in user belongs to (that's the whole
// point: the same person could turn out to be staff or an agency user), so
// it can't safely call an AuthContext that either rejects non-staff outright
// (admin's) or never checks role at all (agent's, a second, unrelated gap
// this doesn't attempt to fix). Instead it calls the two OTP endpoints
// directly via its own short-lived api client instance — once verify-otp
// succeeds, the backend has already set the httpOnly refresh cookie
// (auth.controller.js#issueTokens), so landing on /admin/* or /agent/* is
// enough: that section's own AuthProvider picks the session up itself via
// its existing tryRefresh() bootstrap (unchanged).
//
// That landing is a hard `window.location` navigation, not React Router's
// client-side `navigate()`, deliberately: both admin/App.jsx and
// agent/App.jsx wrap their *entire* <Routes> — including their own `login`
// route — in one AuthProvider instance that's already mounted the moment
// either login page is visible, and a plain client-side navigate() would
// leave that already-mounted provider sitting on the `status: 'anonymous'`
// it bootstrapped with *before* this form ever submitted (its own
// tryRefresh() effect only runs once, on mount) — ProtectedRoute would then
// immediately bounce the freshly-logged-in user straight back to /login. A
// full navigation forces every portal's app (including AuthProvider) to
// remount from scratch, so its bootstrap tryRefresh() runs again — now
// against the refresh cookie this login call just set — for both the
// same-portal case (e.g. a staff login submitted from /admin/login) and the
// cross-portal case (e.g. a staff login submitted from /agent/login, which
// unmounts AgentApp and mounts AdminApp fresh) alike.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiCheckCircle, FiMail } from 'react-icons/fi';
import { createApiClient } from '../api/createApiClient.js';

// A fresh, dedicated client — not shared with (and never touching the
// token state of) either portal's own admin/api/client.js or
// agent/api/client.js singletons. All this needs is the two POST calls;
// nothing here is held onto after that.
const { api: loginApi } = createApiClient();

const INK = '#16233f';
const ACCENT = '#d1642f';
// A second accent already present in this file (the hero panel's own
// checkmark colour) — paired with ACCENT into a gold→coral gradient below
// rather than introducing any brand-new hue. LoginModal is portal-agnostic
// (see this file's own top comment), so it deliberately doesn't borrow
// either portal's own navy/indigo or teal/gold palette — this is its own
// third, "golden hour over Oman" identity built from colours the hero panel
// already used.
const ACCENT_WARM = '#e8935f';

// Must match the backend's OTP_EXPIRY_MINUTES (auth.controller.js) — there's
// no shared-constants module between the two deployables, so this is a
// display-only mirror of that value, not the actual source of truth (the
// backend alone decides when a code really expires; this only drives the
// countdown UI).
const OTP_VALID_SECONDS = 5 * 60;

// Focus ring/border use the brand accent as a Tailwind arbitrary-value
// color (`#d1642f` / `#d1642f26` — 15% alpha) rather than an inline-style
// hack, so this stays plain, ordinary Tailwind like every other input in
// the app, just without depending on either portal's own `--accent`/
// `--agent-accent` custom token (which differ in value between the two).
const INPUT_FOCUS_CLASSES = 'focus:border-[#d1642f] focus:outline-none focus:ring-2 focus:ring-[#d1642f33]';

function LoginTextInput({ icon: Icon, className = '', ...props }) {
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

// 6-digit OTP entry — one plain text input (not six separate boxes), kept
// consistent with every other field in this form; letter-spaced + centred +
// monospace purely for readability of the code as it's typed.
function LoginOtpInput({ className = '', ...props }) {
  return (
    <input
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={6}
      className={`w-full rounded-md border border-slate-200 bg-white px-3.5 py-3 text-center font-mono text-lg tracking-[0.5em] text-slate-900 shadow-sm placeholder:tracking-normal placeholder:text-slate-400 placeholder:font-sans placeholder:text-sm ${INPUT_FOCUS_CLASSES} ${className}`}
      {...props}
    />
  );
}

function formatCountdown(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Reads the same signal admin/context/AuthContext.jsx#isStaffUser already
// uses server-side of this decision (agency_id null = internal staff) —
// not a second, possibly-diverging definition of "who counts as admin".
function isStaffUser(user) {
  return !user.agencyId;
}

// The one, universal copy — not per-portal props, so no caller can
// accidentally reintroduce a difference between where this is mounted.
const TAGLINE = 'Your trade gateway to exclusive Oman experiences';
const FOOTER_NOTE = "By logging in, you agree to Xclusive Oman's current Terms of Service and Privacy Policy.";
const SIGN_UP_HREF = '/agent/register';

// Visual-panel copy only (Phase: LoginModal restyle) — presentational text,
// not a prop, not read by any logic on this page. Adapted from the master
// documentation's own Executive Summary (§1) and feature summaries (§6),
// not invented: the three pricing models, MICE, and dedicated Relationship
// Manager are all real, already-shipped features elsewhere in this app.
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

/**
 * Props — deliberately just the two post-login destinations, nothing
 * visual: adminDestination / agentDestination, where each role lands after
 * a successful login (each call site supplies its own; this component
 * makes the role *decision*, never owns the destination paths themselves).
 * logoSrc defaults to the one shared brand asset every entry point already
 * references directly (public/Xclusive_Oman_Logo_2.png).
 */
export function LoginModal({
  logoSrc = '/Xclusive_Oman_Logo_2.png',
  adminDestination = '/admin/dashboard',
  agentDestination = '/agent/dashboard',
}) {
  const [step, setStep] = useState('email'); // 'email' | 'otp'
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [otpExpiresAt, setOtpExpiresAt] = useState(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  // Ticks the "expires in mm:ss" countdown while the OTP step is showing —
  // purely a UI hint; the backend's own expires_at is what actually decides
  // whether a code is still valid.
  useEffect(() => {
    if (step !== 'otp' || !otpExpiresAt) return undefined;
    const tick = () => setRemainingSeconds(Math.max(0, Math.round((otpExpiresAt - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [step, otpExpiresAt]);

  async function requestOtp() {
    await loginApi.post('/auth/request-otp', { email }, { skipAuth: true });
    setOtp('');
    setOtpExpiresAt(Date.now() + OTP_VALID_SECONDS * 1000);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (step === 'email') {
        await requestOtp();
        // Only the initial send advances the step — handleResend (below)
        // calls the same requestOtp() while already on the OTP step and
        // deliberately does NOT re-set it: a real email send takes a few
        // seconds, and if that promise resolves after the user has already
        // clicked "Use a different email" (handleChangeEmail, which sets
        // step back to 'email' synchronously), this stale completion must
        // not silently snap them back to the OTP step out from under them.
        setStep('otp');
      } else {
        const { user } = await loginApi.post('/auth/verify-otp', { email, otp }, { skipAuth: true });
        const destination = isStaffUser(user) ? adminDestination : agentDestination;
        // Hard navigation — see this file's own top comment for why a plain
        // React Router navigate() isn't safe here.
        window.location.replace(destination);
        return;
      }
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    setError('');
    setResending(true);
    try {
      await requestOtp();
    } catch (err) {
      setError(err.message || 'Unable to resend code');
    } finally {
      setResending(false);
    }
  }

  function handleChangeEmail() {
    setStep('email');
    setOtp('');
    setError('');
    setOtpExpiresAt(null);
  }

  const otpExpired = step === 'otp' && remainingSeconds <= 0;
  const canSubmit = step === 'email' ? email.trim().length > 0 : otp.length === 6 && !otpExpired;

  return (
    <div className="flex min-h-screen bg-[#0b1424]">
      {/* Visual/brand panel — presentational only, hidden below lg. Real
          photo (public/oman_pic.jpg, already shipped), copy adapted from
          the master documentation's own Executive Summary/feature list —
          see this file's own HERO_* constants for exactly which section
          each line comes from. */}
      <div className="relative hidden w-[46%] flex-none overflow-hidden lg:block">
        <img src={HERO_IMAGE_SRC} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b1424] via-[#0b1424]/80 to-[#0b1424]/30" />
        <div className="absolute inset-0 bg-[#0b1424]/10" />

        <div className="relative z-10 flex h-full flex-col justify-between p-12 xl:p-16">
          <img src={logoSrc} alt="Xclusive Oman" className="h-11 w-auto object-contain" />

          <div>
            <div
              style={{ background: `linear-gradient(90deg, ${ACCENT_WARM}, ${ACCENT})` }}
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

      {/* Form panel */}
      <div
        style={{ background: 'linear-gradient(135deg, #FFF8F3 0%, #FFF4EC 50%, #FFEEE5 100%)' }}
        className="relative flex flex-1 items-center justify-center overflow-y-auto px-4 py-10"
      >
        <div className="w-full max-w-[400px]">
          {/* Compact header shown only when the visual panel above is
              hidden (mobile/tablet) — desktop already carries the logo and
              headline on the left. */}
          <div className="mb-8 text-center lg:hidden">
            <img src={logoSrc} alt="Xclusive Oman" className="mx-auto mb-4 h-14 w-auto object-contain" />
            <p className="text-sm text-slate-500">{TAGLINE}</p>
          </div>

          <div className="hidden lg:block lg:mb-8">
            <h2
              style={{
                backgroundImage: `linear-gradient(90deg, ${INK}, ${ACCENT}, ${ACCENT_WARM})`,
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
              }}
              className="text-2xl font-bold"
            >
              Welcome back
            </h2>
            <p className="mt-1.5 text-sm text-slate-500">
              {step === 'email' ? 'Sign in to continue to your dashboard.' : 'Enter the code we just emailed you.'}
            </p>
          </div>

          <div className="relative overflow-hidden rounded-xl border border-white bg-white p-6 shadow-xl shadow-[#d1642f]/[0.08] sm:p-7">
            <div
              style={{ background: `linear-gradient(90deg, ${ACCENT_WARM}, ${ACCENT})` }}
              className="absolute inset-x-0 top-0 h-1"
            />
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase text-slate-500">Email</label>
                <LoginTextInput
                  icon={FiMail}
                  type="email"
                  required
                  autoFocus={step === 'email'}
                  disabled={step === 'otp'}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter Your Email"
                />
              </div>

              {step === 'email' ? (
                <p className="text-xs text-slate-500">
                  We'll email you a 6-digit sign-in code — no password needed.
                </p>
              ) : (
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="block text-[11px] font-semibold uppercase text-slate-500">Verification code</label>
                    <button
                      type="button"
                      onClick={handleChangeEmail}
                      className="text-[11px] font-semibold hover:underline"
                      style={{ color: ACCENT }}
                    >
                      Use a different email
                    </button>
                  </div>
                  <LoginOtpInput
                    required
                    autoFocus
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="••••••"
                  />
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className={otpExpired ? 'font-semibold text-[#a5162d]' : 'text-slate-500'}>
                      {otpExpired ? 'Code expired' : `Expires in ${formatCountdown(remainingSeconds)}`}
                    </span>
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={resending}
                      className="font-semibold hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                      style={{ color: ACCENT }}
                    >
                      {resending ? 'Sending…' : 'Resend code'}
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">Sent to {email}. It expires 5 minutes after each send.</p>
                </div>
              )}

              {error && (
                <p className="rounded-md border border-[#f2bdc6] bg-[#fff7f8] px-3 py-2 text-xs text-[#a5162d]">{error}</p>
              )}

              <button
                type="submit"
                disabled={submitting || !canSubmit}
                className="w-full rounded-md py-3 text-center text-sm font-semibold text-white shadow-lg shadow-[#d1642f]/25 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                style={{ background: `linear-gradient(135deg, ${ACCENT_WARM}, ${ACCENT})` }}
              >
                {step === 'email'
                  ? submitting
                    ? 'Sending code…'
                    : 'Sign In'
                  : submitting
                    ? 'Verifying…'
                    : 'Verify & Sign In'}
              </button>
            </form>

            <p className="mt-5 text-center text-sm text-slate-500">
              Don't have an account?{' '}
              <Link to={SIGN_UP_HREF} className="font-semibold hover:underline" style={{ color: ACCENT }}>
                Sign up
              </Link>
            </p>
          </div>

          <div className="mt-5 text-center text-xs text-slate-500">{FOOTER_NOTE}</div>
        </div>
      </div>
    </div>
  );
}
