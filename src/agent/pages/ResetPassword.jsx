import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Button, ErrorText, FieldLabel, PasswordInput } from '../components/ui.jsx';
import AuthShell from '../components/AuthShell.jsx';

// Landed on from the reset link ForgotPassword's email sends
// (agentPortalUrl + "/reset-password?token=..." — see auth.controller.js's
// forgotPassword). The token is a one-time, 1-hour-lived value the backend
// validates on submit; this page never inspects it beyond reading it off the
// query string.
export default function ResetPassword() {
  const { resetPassword } = useAuth();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await resetPassword({ token, password });
      setDone(true);
    } catch (err) {
      setError(err.message || 'Unable to reset password — the link may have expired.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell>
      <div className="mx-auto w-full max-w-sm text-center">
        <img src="/Xclusive_Oman_Logo_2.png" alt="Xclusive Oman" className="mx-auto h-11 w-auto object-contain" />

        {!token ? (
          <p className="mt-6 text-sm text-[#a5162d]">
            This reset link is missing or invalid. Request a new one from{' '}
            <Link to="/agent/forgot-password" className="font-semibold underline">
              Forgot password
            </Link>
            .
          </p>
        ) : done ? (
          <>
            <p className="mt-6 text-sm leading-relaxed text-agent-muted">Your password has been updated. You can now sign in.</p>
            <Link to="/agent/login" className="mt-6 block">
              <Button variant="solid" className="w-full justify-center rounded-full py-2.5 text-sm">
                Back to Sign In
              </Button>
            </Link>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-agent-muted">Choose a new password for your account.</p>
            <form onSubmit={handleSubmit} className="mt-6 space-y-4 text-left">
              <div>
                <FieldLabel>New password*</FieldLabel>
                <PasswordInput
                  required
                  minLength={8}
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                />
              </div>
              <ErrorText>{error}</ErrorText>
              <Button variant="solid" type="submit" className="w-full justify-center rounded-full py-2.5 text-sm" disabled={submitting}>
                {submitting ? 'Updating…' : 'Update password'}
              </Button>
            </form>
          </>
        )}
      </div>
    </AuthShell>
  );
}
