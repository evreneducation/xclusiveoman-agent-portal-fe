import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api/client.js';
import { Button, ErrorText, FieldLabel, Select, TextInput } from '../components/ui.jsx';
import AuthShell from '../components/AuthShell.jsx';

const COUNTRIES = ['Oman', 'India', 'UAE', 'Saudi Arabia', 'Qatar', 'Kuwait', 'Bahrain', 'Other'];

// jpg/jpeg files report as image/jpeg — there's no separate "image/jpg" MIME
// type — so this list already covers everything the label promises. Mirrors
// the backend's own allow-list (middleware/upload.js), which additionally
// allows image/webp; not offered here since it wasn't asked for, but a webp
// file wouldn't be rejected server-side if someone renamed one past this
// accept filter.
const LICENSE_ACCEPT = 'image/jpeg,image/png,application/pdf';

// No password field — nothing in this app ever collects one anymore. Once
// approved, the new owner signs in the same way everyone else does: email
// OTP (LoginModal.jsx), using this same email address.
//
// Agency Type is no longer a choice here — MICE Company self-signup was
// dropped (every new registration is a Travel Agent; MICE-type agencies are
// still created another way, admin-side, unaffected by this) — so
// agencyType is just a fixed constant, not form state with a picker.
const AGENCY_TYPE = 'travel_agent';

export default function Register() {
  const { register } = useAuth();
  const [form, setForm] = useState({
    agencyName: '',
    licenseNumber: '',
    country: 'Oman',
    ownerFullName: '',
    email: '',
    phone: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // IATA/License document — mandatory upload (jpg/png/jpeg/pdf), replacing
  // the old plain-text-only license number field. Uploaded immediately on
  // selection (same upload-then-submit-the-URL pattern as every other file
  // upload in this app, e.g. Payment.jsx's NEFT slip) rather than deferred
  // to form submit, so the Sign Up form itself stays a plain JSON POST.
  const [licenseFile, setLicenseFile] = useState(null);
  const [licenseDocumentUrl, setLicenseDocumentUrl] = useState('');
  const [licenseUploading, setLicenseUploading] = useState(false);
  const [licenseError, setLicenseError] = useState('');

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleLicenseFileChange(e) {
    const file = e.target.files?.[0] || null;
    setLicenseFile(file);
    setLicenseDocumentUrl('');
    setLicenseError('');
    if (!file) return;

    setLicenseUploading(true);
    try {
      const formData = new FormData();
      formData.append('licenseDocument', file);
      const { url } = await api.postForm('/auth/register/license-document', formData);
      setLicenseDocumentUrl(url);
    } catch (err) {
      setLicenseError(err.message || 'Unable to upload document');
      setLicenseFile(null);
    } finally {
      setLicenseUploading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!licenseDocumentUrl) {
      setError('Upload your IATA/License document to continue');
      return;
    }
    setSubmitting(true);
    try {
      await register({ ...form, agencyType: AGENCY_TYPE, licenseDocumentUrl });
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Unable to submit registration');
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <AuthShell>
        <div className="mx-auto w-full max-w-sm text-center">
          <img src="/Xclusive_Oman_Logo_2.png" alt="Xclusive Oman" className="mx-auto h-11 w-auto object-contain" />
          <div className="mx-auto mt-6 flex h-11 w-11 items-center justify-center rounded-full bg-[#e9f7ef] text-lg text-[#227647]">✓</div>
          <h2 className="mt-3 text-xl font-bold text-agent-ink">Registration submitted</h2>
          <p className="mt-2 text-sm leading-relaxed text-agent-muted">
            Thanks — your registration is now <span className="font-semibold text-agent-ink">Pending Approval</span>. A
            Super Admin will review it, assign your tier, and you'll be able to sign in once approved.
          </p>
          <Link to="/agent/login" className="mt-6 block">
            <Button variant="solid" className="w-full justify-center rounded-full py-2.5 text-sm">
              Back to Sign In
            </Button>
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div className="mx-auto w-full max-w-xl">
        <div className="flex flex-col items-center text-center">
          <img src="/Xclusive_Oman_Logo_2.png" alt="Xclusive Oman" className="h-11 w-auto object-contain" />
          <p className="mt-2 text-sm text-agent-muted">Register your agency for trade access — takes about two minutes.</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4 text-left">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FieldLabel>Company name*</FieldLabel>
              <TextInput required autoFocus value={form.agencyName} onChange={(e) => update('agencyName', e.target.value)} />
            </div>

            <div>
              <FieldLabel>IATA / License No. (optional)</FieldLabel>
              <TextInput value={form.licenseNumber} onChange={(e) => update('licenseNumber', e.target.value)} />
            </div>
            <div>
              <FieldLabel>Country*</FieldLabel>
              <Select value={form.country} onChange={(e) => update('country', e.target.value)}>
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </div>

            <div className="sm:col-span-2">
              <FieldLabel>Upload IATA / License Document*</FieldLabel>
              <input
                type="file"
                required
                accept={LICENSE_ACCEPT}
                onChange={handleLicenseFileChange}
                className="w-full rounded-md border border-agent-line-light bg-white px-3 py-2.5 text-sm text-agent-ink shadow-sm file:mr-3 file:rounded-md file:border-0 file:bg-agent-panel file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-agent-ink-dark"
              />
              <p className="mt-1.5 text-xs text-agent-muted">
                {licenseUploading
                  ? 'Uploading…'
                  : licenseDocumentUrl
                    ? `✓ ${licenseFile?.name || 'Document'} uploaded`
                    : 'Accepted formats: JPG, PNG, PDF.'}
              </p>
              <ErrorText>{licenseError}</ErrorText>
            </div>

            <div>
              <FieldLabel>Owner full name*</FieldLabel>
              <TextInput required value={form.ownerFullName} onChange={(e) => update('ownerFullName', e.target.value)} />
            </div>
            <div>
              <FieldLabel>Phone*</FieldLabel>
              <TextInput required value={form.phone} onChange={(e) => update('phone', e.target.value)} />
            </div>

            <div className="sm:col-span-2">
              <FieldLabel>Email*</FieldLabel>
              <TextInput type="email" required value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="Enter your email" />
              <p className="mt-1.5 text-xs text-agent-muted">
                No password to set — once approved, you'll sign in with a code emailed to this address.
              </p>
            </div>
          </div>

          <ErrorText>{error}</ErrorText>
          <Button
            variant="accent"
            type="submit"
            className="w-full justify-center rounded-full py-2.5 text-sm"
            disabled={submitting || licenseUploading}
          >
            {submitting ? 'Submitting…' : 'Submit for Approval'}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-agent-muted">
          Already registered?{' '}
          <Link to="/agent/login" className="font-semibold text-agent-accent-dark hover:underline">
            Sign in
          </Link>
        </p>

        <p className="mt-6 text-center text-[11px] leading-relaxed text-agent-muted">
          By creating an account, you agree to Xclusive Oman's current Terms of Service and Privacy Policy.
        </p>
      </div>
    </AuthShell>
  );
}
