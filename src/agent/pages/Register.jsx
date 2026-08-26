import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiBriefcase, FiMail, FiPhone, FiUser } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api/client.js';
import { ErrorText } from '../components/ui.jsx';
import AuthShell, { AUTH_ACCENT, AuthButton, AuthFieldLabel, AuthSelect, AuthTextInput } from '../components/AuthShell.jsx';
import { ImageUpload } from '../../shared/components/ImageUpload.jsx';

const COUNTRIES = ['Oman', 'India', 'UAE', 'Saudi Arabia', 'Qatar', 'Kuwait', 'Bahrain', 'Other'];

// jpg/jpeg files report as image/jpeg — there's no separate "image/jpg" MIME
// type — so this list already covers everything the label promises. Mirrors
// the backend's own allow-list (middleware/upload.js), which additionally
// allows image/webp; not offered here since it wasn't asked for, but a webp
// file wouldn't be rejected server-side if someone renamed one past this
// accept filter.
const LICENSE_ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
const LICENSE_ACCEPT_HINT = 'JPG, PNG, PDF';

const FOOTER_NOTE = "By creating an account, you agree to Xclusive Oman's current Terms of Service and Privacy Policy.";

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
    country: 'Oman',
    ownerFullName: '',
    email: '',
    phone: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // IATA/License — now an upload only (jpg/png/jpeg/pdf), mandatory; the
  // free-text license number field is gone entirely, not just supplemented.
  // Uploaded immediately on selection (same upload-then-submit-the-URL
  // pattern as every other file upload in this app, e.g. Payment.jsx's NEFT
  // slip) rather than deferred to form submit, so the Sign Up form itself
  // stays a plain JSON POST. The shared ImageUpload component owns the
  // uploading/error state around that upload itself — this only needs to
  // remember the resulting URL.
  const [licenseDocumentUrl, setLicenseDocumentUrl] = useState('');

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function uploadLicenseDocument(file) {
    const formData = new FormData();
    formData.append('licenseDocument', file);
    const { url } = await api.postForm('/auth/register/license-document', formData);
    return url;
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
      <AuthShell title="Registration submitted" tagline="Your trade gateway to exclusive Oman experiences">
        <div className="text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#e9f7ef] text-lg text-[#227647]">
            ✓
          </div>
          <h2 className="mt-3 text-xl font-bold text-slate-900">Registration submitted</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            Thanks — your registration is now <span className="font-semibold text-slate-900">Pending Approval</span>. A
            Super Admin will review it, assign your tier, and you'll be able to sign in once approved.
          </p>
          <Link to="/agent/login" className="mt-6 block">
            <AuthButton type="button">Back to Sign In</AuthButton>
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="Agent Sign Up"
      title="Create your account"
      subtitle="Register your agency for trade access — takes about two minutes."
      tagline="Register your agency for trade access — takes about two minutes."
      footerNote={FOOTER_NOTE}
      maxWidthClassName="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <AuthFieldLabel>Company name*</AuthFieldLabel>
            <AuthTextInput
              icon={FiBriefcase}
              required
              autoFocus
              value={form.agencyName}
              onChange={(e) => update('agencyName', e.target.value)}
            />
          </div>

          <div className="sm:col-span-2">
            <AuthFieldLabel>Country*</AuthFieldLabel>
            <AuthSelect value={form.country} onChange={(e) => update('country', e.target.value)}>
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </AuthSelect>
          </div>

          <div className="sm:col-span-2">
            <ImageUpload
              label="IATA / GST / Company Registration"
              required
              value={licenseDocumentUrl}
              onChange={setLicenseDocumentUrl}
              onUpload={uploadLicenseDocument}
              acceptedTypes={LICENSE_ACCEPTED_TYPES}
              acceptHint={LICENSE_ACCEPT_HINT}
            />
          </div>

          <div>
            <AuthFieldLabel>Owner full name*</AuthFieldLabel>
            <AuthTextInput icon={FiUser} required value={form.ownerFullName} onChange={(e) => update('ownerFullName', e.target.value)} />
          </div>
          <div>
            <AuthFieldLabel>Phone*</AuthFieldLabel>
            <AuthTextInput icon={FiPhone} required value={form.phone} onChange={(e) => update('phone', e.target.value)} />
          </div>

          <div className="sm:col-span-2">
            <AuthFieldLabel>Email*</AuthFieldLabel>
            <AuthTextInput
              icon={FiMail}
              type="email"
              required
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              placeholder="Enter your email"
            />
            <p className="mt-1.5 text-xs text-slate-500">
              No password to set — once approved, you'll sign in with a code emailed to this address.
            </p>
          </div>
        </div>

        <ErrorText>{error}</ErrorText>
        <AuthButton type="submit" disabled={submitting}>
          {submitting ? 'Submitting…' : 'Submit for Approval'}
        </AuthButton>
      </form>

      <p className="mt-5 text-center text-sm text-slate-500">
        Already registered?{' '}
        <Link to="/agent/login" className="font-semibold hover:underline" style={{ color: AUTH_ACCENT }}>
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
