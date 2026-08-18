// Single, shared login screen for both the Admin Console and the Agent
// Portal — replaces what used to be two separate, hand-built forms
// (admin/pages/Login.jsx, agent/pages/Login.jsx), and is also what the app
// root ("/") renders directly (App.jsx). Renders byte-for-byte identically
// everywhere it's used — same tagline, same fields, same Remember me/Forgot
// password/Sign up links, same footer note — on purpose: nobody visiting
// any of the three entry points is asked to declare "I'm staff" or "I'm an
// agent" first, so there is nothing left here that could differ before
// that's known. The only thing that ever varies per call site is where a
// successful login *lands* afterward (adminDestination/agentDestination
// below) — which is invisible until after that decision is already made.
// Portal-agnostic by the same rule NotificationBell.jsx already established
// for this directory: no `agent-*`/admin `ink` Tailwind tokens, no import
// from either portal's own components/ui.jsx.
//
// Forgot password and Sign up are shown unconditionally, including to a
// visitor who'll turn out to be staff: POST /auth/forgot-password and its
// reset flow are role-agnostic server-side (auth.controller.js#resetPassword
// updates whichever user the token belongs to, no agency/role check), so a
// staff account can genuinely use it; POST /auth/register is a public
// endpoint regardless of what page links to it. Neither link can grant
// inappropriate access — at worst a staff visitor sees a link that doesn't
// apply to them and ignores it.
//
// The actual login call also intentionally does NOT go through either
// portal's own AuthContext#login() — this is the one part of the app that
// doesn't yet know which portal the signed-in user belongs to (that's the
// whole point: the same person could turn out to be staff or an agency
// user), so it can't safely call an AuthContext that either rejects
// non-staff outright (admin's) or never checks role at all (agent's, a
// second, unrelated gap this doesn't attempt to fix). Instead it calls
// POST /auth/login directly via its own short-lived api client instance —
// once that succeeds, the backend has already set the httpOnly refresh
// cookie (auth.controller.js#issueTokens), so landing on /admin/* or
// /agent/* is enough: that section's own AuthProvider picks the session up
// itself via its existing tryRefresh() bootstrap (unchanged).
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
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiEye, FiEyeOff, FiMail } from 'react-icons/fi';
import { createApiClient } from '../api/createApiClient.js';

// A fresh, dedicated client — not shared with (and never touching the
// token state of) either portal's own admin/api/client.js or
// agent/api/client.js singletons. All this needs is the one POST call;
// nothing here is held onto after that.
const { api: loginApi } = createApiClient();

const INK = '#16233f';
const ACCENT = '#d1642f';

// Focus ring/border use the brand accent as a Tailwind arbitrary-value
// color (`#d1642f` / `#d1642f26` — 15% alpha) rather than an inline-style
// hack, so this stays plain, ordinary Tailwind like every other input in
// the app, just without depending on either portal's own `--accent`/
// `--agent-accent` custom token (which differ in value between the two).
const INPUT_FOCUS_CLASSES = 'focus:border-[#d1642f] focus:outline-none focus:ring-2 focus:ring-[#d1642f26]';

function LoginTextInput({ icon: Icon, className = '', ...props }) {
  return (
    <div className="relative">
      {Icon && <Icon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />}
      <input
        className={`w-full rounded-md border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 ${INPUT_FOCUS_CLASSES} ${
          Icon ? 'pl-9' : ''
        } ${className}`}
        {...props}
      />
    </div>
  );
}

function LoginPasswordInput(props) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        type={visible ? 'text' : 'password'}
        className={`w-full rounded-md border border-slate-200 bg-white px-3.5 py-3 pr-10 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 ${INPUT_FOCUS_CLASSES}`}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        tabIndex={-1}
        aria-label={visible ? 'Hide password' : 'Show password'}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
      >
        {visible ? <FiEyeOff size={16} /> : <FiEye size={16} />}
      </button>
    </div>
  );
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
const FORGOT_PASSWORD_HREF = '/agent/forgot-password';
const SIGN_UP_HREF = '/agent/register';

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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const { user } = await loginApi.post('/auth/login', { email, password }, { skipAuth: true });
      const destination = isStaffUser(user) ? adminDestination : agentDestination;
      // Hard navigation — see this file's own top comment for why a plain
      // React Router navigate() isn't safe here.
      window.location.replace(destination);
    } catch (err) {
      setError(err.message || 'Unable to sign in');
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top_left,#f7d8c6_0,#f6eee9_28%,#edf1f0_58%,#e7e5e0_100%)] px-4 py-10">
      <div className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full blur-3xl" style={{ background: `${ACCENT}33` }} />
      <div className="pointer-events-none absolute -bottom-32 -right-16 h-[28rem] w-[28rem] rounded-full blur-3xl" style={{ background: `${INK}1a` }} />

      <div className="relative z-10 w-full max-w-[440px]">
        <div className="mb-8 text-center">
          <img src={logoSrc} alt="Xclusive Oman" className="mx-auto mb-4 h-14 w-auto object-contain" />
          <p className="text-sm text-slate-500">{TAGLINE}</p>
        </div>

        <div className="rounded-lg border border-white/70 bg-white/95 p-6 shadow-xl shadow-black/10 sm:p-7">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase text-slate-500">Email</label>
              <LoginTextInput
                icon={FiMail}
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@xclusiveoman.com"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase text-slate-500">Password</label>
              <LoginPasswordInput
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-600">
                <span
                  onClick={() => setRememberMe((v) => !v)}
                  className={`flex h-4 w-4 flex-none items-center justify-center rounded border-[1.5px] ${
                    rememberMe ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white'
                  }`}
                >
                  {rememberMe ? '✓' : ''}
                </span>
                Remember me
              </label>
              <Link to={FORGOT_PASSWORD_HREF} className="text-xs font-semibold hover:underline" style={{ color: ACCENT }}>
                Forgot password?
              </Link>
            </div>

            {error && (
              <p className="rounded-md border border-[#f2bdc6] bg-[#fff7f8] px-3 py-2 text-xs text-[#a5162d]">{error}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-md py-3 text-center text-sm font-semibold text-white shadow-sm transition disabled:opacity-60"
              style={{ background: INK }}
            >
              {submitting ? 'Signing in…' : 'Sign In'}
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
  );
}
