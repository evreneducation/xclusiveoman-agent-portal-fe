import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiMail } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext.jsx';
import { Button, ErrorText, FieldLabel, TextInput } from '../components/ui.jsx';
import AuthShell from '../components/AuthShell.jsx';

// Reached from Login's "Forgot password?" link. Backend always responds the
// same way whether or not the email is registered (auth.controller.js), so
// this never reveals which accounts exist — same neutral confirmation
// copy either way.
export default function ForgotPassword() {
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(err.message || 'Unable to send reset link');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell>
      <div className="mx-auto w-full max-w-sm text-center">
        <img src="/Xclusive_Oman_Logo_2.png" alt="Xclusive Oman" className="mx-auto h-11 w-auto object-contain" />

        {sent ? (
          <>
            <p className="mt-6 text-sm leading-relaxed text-agent-muted">
              If an account exists for <span className="font-semibold text-agent-ink">{email}</span>, we've sent a
              link to reset your password. The link expires in 1 hour.
            </p>
            <Link to="/agent/login" className="mt-6 block">
              <Button variant="solid" className="w-full justify-center rounded-full py-2.5 text-sm">
                Back to Sign In
              </Button>
            </Link>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-agent-muted">Enter your account email and we'll send you a link to reset your password.</p>
            <form onSubmit={handleSubmit} className="mt-6 space-y-4 text-left">
              <div>
                <FieldLabel>Email*</FieldLabel>
                <div className="relative">
                  <FiMail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-agent-muted" size={16} />
                  <TextInput
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="pl-9"
                  />
                </div>
              </div>
              <ErrorText>{error}</ErrorText>
              <Button variant="solid" type="submit" className="w-full justify-center rounded-full py-2.5 text-sm" disabled={submitting}>
                {submitting ? 'Sending…' : 'Send reset link'}
              </Button>
            </form>
            <p className="mt-5 text-center text-sm text-agent-muted">
              Remembered it?{' '}
              <Link to="/agent/login" className="font-semibold text-agent-accent-dark hover:underline">
                Back to Sign In
              </Link>
            </p>
          </>
        )}
      </div>
    </AuthShell>
  );
}
