import { useEffect, useState } from 'react';
import { LuShieldCheck, LuKeyRound, LuMail, LuLoaderCircle } from 'react-icons/lu';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Button, Card, ErrorText } from '../components/ui.jsx';

// Admin console "Security" screen (a top-level sidebar item). One control
// that actually does something today: a GLOBAL authenticator-app (TOTP)
// toggle — when it's on, every admin-console sign-in needs a 6-digit code
// from Google Authenticator / Authy after the emailed code (the extra step
// lives in shared/components/LoginModal.jsx; the backend is
// controllers/adminSecurity.controller.js + the auth.controller.js login
// flow). "Email verification" is shown as a disabled preview to match the
// intended design — not wired up yet.
//
// There's no per-user enrolment: the whole console shares one secret, set
// up once here by a super_admin. Non-super staff can see the state but the
// enrol/disable calls are super_admin-only server-side.

const PRIMARY_BUTTON_CLASS =
  'border-transparent bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white shadow-[0_6px_16px_rgba(99,102,241,0.25)] hover:border-transparent hover:opacity-90';

function StatusBadge({ on }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
        on ? 'border-[#A7F3D0] bg-[#ECFDF5] text-[#047857]' : 'border-[#D7DDF0] bg-[#F1F3F9] text-[#64748B]'
      }`}
    >
      {on ? 'On' : 'Off'}
    </span>
  );
}

// One plain 6-digit field, same treatment as the login screen's OTP input
// (centred, letter-spaced, monospace) — kept local rather than shared since
// this page and LoginModal.jsx don't otherwise overlap.
function CodeInput(props) {
  return (
    <input
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={6}
      placeholder="000000"
      className="w-40 rounded-md border border-[#D7DDF0] bg-[#FAFBFF] px-3.5 py-2.5 text-center font-mono text-lg tracking-[0.4em] text-ink shadow-sm placeholder:tracking-[0.3em] placeholder:text-[#B8C0D9] focus:border-[#6366F1] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/15"
      {...props}
    />
  );
}

function AuthenticatorCard({ status, isSuperAdmin, onStatusChange }) {
  // 'idle' | 'enrolling' (QR + confirm code shown) | 'disabling' (code shown)
  const [mode, setMode] = useState('idle');
  const [enrollment, setEnrollment] = useState(null); // { secret, otpauthUri, qrDataUri }
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const enabled = status.enabled;

  function reset() {
    setMode('idle');
    setEnrollment(null);
    setCode('');
    setError('');
  }

  async function startEnrollment() {
    setBusy(true);
    setError('');
    try {
      const data = await api.post('/admin/security/totp/enroll');
      setEnrollment(data);
      setCode('');
      setMode('enrolling');
    } catch (err) {
      setError(err.message || 'Unable to start setup');
    } finally {
      setBusy(false);
    }
  }

  async function confirmEnrollment() {
    setBusy(true);
    setError('');
    try {
      const { twoFactor } = await api.post('/admin/security/totp/activate', { code });
      onStatusChange(twoFactor);
      reset();
    } catch (err) {
      setError(err.message || 'That code was not accepted');
    } finally {
      setBusy(false);
    }
  }

  async function confirmDisable() {
    setBusy(true);
    setError('');
    try {
      const { twoFactor } = await api.post('/admin/security/totp/disable', { code });
      onStatusChange(twoFactor);
      reset();
    } catch (err) {
      setError(err.message || 'That code was not accepted');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="flex items-start gap-4">
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-accent-soft text-accent">
          <LuKeyRound size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-ink">Authenticator app (MFA)</span>
            <StatusBadge on={enabled} />
          </div>
          <p className="mt-1 text-xs text-muted">
            Use Google Authenticator, Authy, or any TOTP app for a 6-digit code.
          </p>

          {!isSuperAdmin && (
            <p className="mt-3 text-xs text-muted">
              Only a super admin can change this setting.
            </p>
          )}

          {/* idle — just the turn on / turn off button */}
          {isSuperAdmin && mode === 'idle' && (
            <div className="mt-3">
              {enabled ? (
                <Button onClick={() => { setMode('disabling'); setCode(''); setError(''); }}>Turn off</Button>
              ) : (
                <Button variant="accent" className={PRIMARY_BUTTON_CLASS} disabled={busy} onClick={startEnrollment}>
                  {busy ? 'Starting…' : 'Turn on'}
                </Button>
              )}
            </div>
          )}

          {/* enrolling — scan the QR, then confirm with a live code */}
          {isSuperAdmin && mode === 'enrolling' && enrollment && (
            <div className="mt-4 rounded-lg border border-[#E4E9FB] bg-[#FAFBFF] p-4">
              <div className="text-xs font-semibold text-ink">1. Scan this in your authenticator app</div>
              <div className="mt-3 flex flex-wrap items-start gap-4">
                <img
                  src={enrollment.qrDataUri}
                  alt="Authenticator setup QR code"
                  className="h-40 w-40 flex-none rounded-md border border-[#E4E9FB] bg-white p-1"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-semibold uppercase text-[#64748B]">Or enter this key manually</div>
                  <code className="mt-1 block break-all rounded-md border border-[#E4E9FB] bg-white px-2.5 py-2 font-mono text-xs text-ink">
                    {enrollment.secret}
                  </code>
                </div>
              </div>
              <div className="mt-4 text-xs font-semibold text-ink">2. Enter the current 6-digit code</div>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <CodeInput value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />
                <Button
                  variant="accent"
                  className={PRIMARY_BUTTON_CLASS}
                  disabled={busy || code.length !== 6}
                  onClick={confirmEnrollment}
                >
                  {busy ? 'Verifying…' : 'Verify & turn on'}
                </Button>
                <Button disabled={busy} onClick={reset}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* disabling — confirm with a live code so a walk-up can't strip 2FA */}
          {isSuperAdmin && mode === 'disabling' && (
            <div className="mt-4 rounded-lg border border-[#E4E9FB] bg-[#FAFBFF] p-4">
              <div className="text-xs text-ink">
                Enter a current code from your authenticator app to turn 2FA off for the whole admin console.
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <CodeInput value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />
                <Button disabled={busy || code.length !== 6} onClick={confirmDisable}>
                  {busy ? 'Turning off…' : 'Turn off 2FA'}
                </Button>
                <Button disabled={busy} onClick={reset}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          <ErrorText>{error}</ErrorText>
        </div>
      </div>
    </Card>
  );
}

function EmailCard() {
  return (
    <Card className="opacity-70">
      <div className="flex items-start gap-4">
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-[#F1F3F9] text-[#64748B]">
          <LuMail size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-ink">Email verification</span>
            <span className="inline-flex items-center rounded-full border border-[#D7DDF0] bg-[#F1F3F9] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#64748B]">
              Coming soon
            </span>
          </div>
          <p className="mt-1 text-xs text-muted">
            A code emailed at each sign-in, to an inbox you choose. Not available yet — use the authenticator app above.
          </p>
        </div>
      </div>
    </Card>
  );
}

export default function Security() {
  const { isSuperAdmin } = useAuth();
  const [status, setStatus] = useState(null); // { enabled, pending }
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    api
      .get('/admin/security')
      .then(({ twoFactor }) => setStatus(twoFactor))
      .catch((err) => setLoadError(err.message || 'Unable to load security settings'));
  }, []);

  return (
    <div style={{ background: 'linear-gradient(135deg, #F4F7FF 0%, #FAF7FF 50%, #FFF8F3 100%)' }} className="min-h-screen">
      <div className="mx-auto max-w-3xl p-6 lg:p-10">
        <h2
          style={{
            backgroundImage: 'linear-gradient(90deg, #172554, #4F46E5, #7C3AED)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
          }}
          className="mb-2 flex items-center gap-2 text-3xl font-bold"
        >
          <LuShieldCheck className="text-[#4F46E5]" size={26} />
          Two-Factor Authentication
        </h2>
        <p className="mb-6 max-w-2xl text-sm text-muted">
          Add a second step after your sign-in code. Once turned on, signing in to the admin console needs a 6-digit
          authenticator code too — so a compromised inbox alone can&apos;t open the admin panel.
        </p>

        {loadError ? (
          <ErrorText>{loadError}</ErrorText>
        ) : status === null ? (
          <p className="flex items-center gap-2 text-xs text-muted">
            <LuLoaderCircle className="animate-spin" size={14} /> Loading…
          </p>
        ) : (
          <div className="space-y-4">
            <AuthenticatorCard status={status} isSuperAdmin={isSuperAdmin} onStatusChange={setStatus} />
            <EmailCard />
          </div>
        )}
      </div>
    </div>
  );
}
