import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Button, ErrorText, FieldLabel, PasswordInput, Select, Tag, TextInput } from '../components/ui.jsx';
import AuthShell from '../components/AuthShell.jsx';

const COUNTRIES = ['Oman', 'India', 'UAE', 'Saudi Arabia', 'Qatar', 'Kuwait', 'Bahrain', 'Other'];

const BENEFITS = [
  'Access exclusive FIT & MICE trade rates',
  'A dedicated Relationship Manager for your agency',
  'Real-time quote, booking & payment tracking',
  'Most agencies reviewed and approved within 48 hours',
];

export default function Register() {
  const { register } = useAuth();
  const [form, setForm] = useState({
    agencyName: '',
    agencyType: 'travel_agent',
    licenseNumber: '',
    country: 'Oman',
    ownerFullName: '',
    email: '',
    phone: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await register(form);
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Unable to submit registration');
    } finally {
      setSubmitting(false);
    }
  }

  const panelFooter = (
    <div className="space-y-2.5 text-sm text-white/80">
      {BENEFITS.map((b) => (
        <div key={b} className="flex items-start gap-2.5 rounded-lg border border-white/10 bg-white/5 px-4 py-3">
          <span className="mt-0.5 flex-none text-agent-accent">✓</span>
          <span>{b}</span>
        </div>
      ))}
    </div>
  );

  if (success) {
    return (
      <AuthShell
        eyebrow="Join the network"
        heading="Register your agency for trade access"
        tagline="Tell us about your agency — a Super Admin reviews every application personally."
        panelFooter={panelFooter}
      >
        <div className="mx-auto w-full max-w-md rounded-2xl border border-agent-line-light bg-white/95 p-7 shadow-xl shadow-black/5 sm:p-8">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[#e9f7ef] text-lg text-[#227647]">✓</div>
          <h2 className="text-xl font-bold text-agent-ink">Registration submitted</h2>
          <p className="mt-2 text-sm leading-relaxed text-agent-muted">
            Thanks — your registration is now <span className="font-semibold text-agent-ink">Pending Approval</span>. A
            Super Admin will review it, assign your tier, and you'll be able to sign in once approved.
          </p>
          <Link to="/agent/login" className="mt-6 block">
            <Button variant="solid" className="w-full py-2.5 text-center text-sm">
              Back to Sign In
            </Button>
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="Join the network"
      heading="Register your agency for trade access"
      tagline="Tell us about your agency — a Super Admin reviews every application personally."
      panelFooter={panelFooter}
    >
      <div className="mx-auto w-full max-w-xl rounded-2xl border border-agent-line-light bg-white/95 p-7 shadow-xl shadow-black/5 sm:p-8">
        <h2 className="text-xl font-bold text-agent-ink">Create an agency account</h2>
        <p className="mt-1 text-sm text-agent-muted">Takes about two minutes — you'll be notified once approved.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FieldLabel>Company name</FieldLabel>
              <TextInput required autoFocus value={form.agencyName} onChange={(e) => update('agencyName', e.target.value)} />
            </div>

            <div className="sm:col-span-2">
              <FieldLabel>Agency type</FieldLabel>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => update('agencyType', 'travel_agent')}>
                  <Tag active={form.agencyType === 'travel_agent'}>Travel Agent</Tag>
                </button>
                <button type="button" onClick={() => update('agencyType', 'mice_company')}>
                  <Tag active={form.agencyType === 'mice_company'}>MICE Company</Tag>
                </button>
              </div>
            </div>

            <div>
              <FieldLabel>IATA / License No. (optional)</FieldLabel>
              <TextInput value={form.licenseNumber} onChange={(e) => update('licenseNumber', e.target.value)} />
            </div>
            <div>
              <FieldLabel>Country</FieldLabel>
              <Select value={form.country} onChange={(e) => update('country', e.target.value)}>
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <FieldLabel>Owner full name</FieldLabel>
              <TextInput required value={form.ownerFullName} onChange={(e) => update('ownerFullName', e.target.value)} />
            </div>
            <div>
              <FieldLabel>Phone</FieldLabel>
              <TextInput required value={form.phone} onChange={(e) => update('phone', e.target.value)} />
            </div>

            <div className="sm:col-span-2">
              <FieldLabel>Email address</FieldLabel>
              <TextInput type="email" required value={form.email} onChange={(e) => update('email', e.target.value)} />
            </div>

            <div className="sm:col-span-2">
              <FieldLabel>Password</FieldLabel>
              <PasswordInput
                required
                minLength={8}
                value={form.password}
                onChange={(e) => update('password', e.target.value)}
                placeholder="At least 8 characters"
              />
            </div>
          </div>

          <ErrorText>{error}</ErrorText>
          <Button variant="accent" type="submit" className="w-full py-2.5 text-center text-sm" disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit for Approval'}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-agent-muted">
          Already registered?{' '}
          <Link to="/agent/login" className="font-semibold text-agent-accent-dark hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
