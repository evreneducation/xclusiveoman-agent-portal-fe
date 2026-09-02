import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { useToast } from '../../shared/components/ToastProvider.jsx';
import { downloadDocument } from '../../shared/documents/downloadDocument.js';
import { ImageUpload } from '../../shared/components/ImageUpload.jsx';
import { Badge, Button, Card, Checkbox, ErrorText, FieldLabel, Table, TextInput, Textarea } from '../components/ui.jsx';

// Same accept list agent/pages/BookingDetail.jsx's own traveler-document
// pickers use.
const DOC_ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

// Admin Booking & Visa Processing (Task 14 — Screen 23, DOC-2..6). Booking
// selection/list (BookingsDocuments.jsx) -> this detail screen -> traveler
// list -> documents per traveler (passport/photo readonly + visa upload) ->
// booking-level voucher -> Download / Email to Supplier.
//
// No manual "Notify Agent" step here anymore — every visa copy/voucher
// upload below unlocks and notifies the agent automatically the moment it's
// saved (travelerDocumentsAdmin.controller.js#notifyAgentDocumentsReadyOnce
// on the backend); this screen just reflects that it already happened.

function Modal({ title, onClose, children, footer }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />
      <div className="relative z-10 flex max-h-[85vh] w-full max-w-2xl flex-col rounded-lg border border-line-light bg-white p-5 shadow-lg sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h3 className="text-lg font-bold text-ink">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="text-lg leading-none text-muted hover:text-ink">
            ×
          </button>
        </div>
        <div className="overflow-y-auto">{children}</div>
        {footer && <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-line-light pt-4">{footer}</div>}
      </div>
    </div>
  );
}

function DocStatus({ uploaded, label }) {
  return <Badge tone={uploaded ? 'green' : 'grey'}>{uploaded ? `${label}: Uploaded` : `${label}: Missing`}</Badge>;
}

function VisaUploadInline({ bookingId, travelerId, uploaded, onUploaded }) {
  const toast = useToast();

  async function uploadVisa(file) {
    const formData = new FormData();
    formData.append('visaCopy', file);
    await api.postForm(`/admin/bookings/${bookingId}/travelers/${travelerId}/visa-copy`, formData);
    toast.success('Visa copy uploaded — the agent can download it now.');
    onUploaded();
    // ImageUpload's `value` is normally a URL it previews as a thumbnail —
    // the admin has no reason to preview it here (they just uploaded it,
    // Download above already covers viewing it), so 'uploaded' is a plain
    // non-image sentinel: falls back to ImageUpload's generic document-icon
    // chip + "Change file" affordance instead.
    return 'uploaded';
  }

  return (
    <ImageUpload
      value={uploaded ? 'uploaded' : ''}
      onChange={() => {}}
      onUpload={uploadVisa}
      acceptedTypes={DOC_ACCEPTED_TYPES}
      acceptHint="JPG, PNG, WebP, or PDF"
    />
  );
}

export default function BookingDetailAdmin() {
  const { bookingId } = useParams();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState('');

  const [emailOpen, setEmailOpen] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [selectedRefs, setSelectedRefs] = useState([]);
  const [emailSubmitting, setEmailSubmitting] = useState(false);
  const [emailError, setEmailError] = useState('');

  function loadDetail() {
    setLoading(true);
    setError('');
    return api
      .get(`/admin/bookings/${bookingId}/documents`)
      .then(setData)
      .catch((err) => setError(err.message || 'Unable to load this booking'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  function toggleRef(ref) {
    const key = `${ref.type}:${ref.travelerId || ''}`;
    setSelectedRefs((refs) => {
      const exists = refs.some((r) => `${r.type}:${r.travelerId || ''}` === key);
      return exists ? refs.filter((r) => `${r.type}:${r.travelerId || ''}` !== key) : [...refs, ref];
    });
  }
  function isRefSelected(ref) {
    const key = `${ref.type}:${ref.travelerId || ''}`;
    return selectedRefs.some((r) => `${r.type}:${r.travelerId || ''}` === key);
  }

  async function handleDownload(url) {
    setDownloading(url);
    try {
      await downloadDocument(api, url);
    } catch (err) {
      toast.error(err.message || 'Unable to download this document');
    } finally {
      setDownloading('');
    }
  }

  async function handleDownloadAll() {
    await handleDownload(`/admin/bookings/${bookingId}/documents/download-all`);
  }

  async function uploadVoucher(file) {
    const formData = new FormData();
    formData.append('voucher', file);
    await api.postForm(`/admin/bookings/${bookingId}/voucher`, formData);
    toast.success('Voucher uploaded — the agent can download it now.');
    loadDetail();
    return 'uploaded';
  }

  async function handleSendEmail() {
    setEmailError('');
    if (!emailTo.trim()) {
      setEmailError('Enter the supplier/visa-authority email address.');
      return;
    }
    if (selectedRefs.length === 0) {
      setEmailError('Select at least one document to send.');
      return;
    }
    setEmailSubmitting(true);
    try {
      const { documentCount } = await api.post(`/admin/bookings/${bookingId}/documents/email-to-supplier`, {
        to: emailTo.trim(),
        message: emailMessage.trim() || undefined,
        documentRefs: selectedRefs,
      });
      toast.success(`${documentCount} document(s) emailed to ${emailTo.trim()}.`);
      setEmailOpen(false);
      setEmailTo('');
      setEmailMessage('');
      setSelectedRefs([]);
    } catch (err) {
      setEmailError(err.message || 'Unable to send the email');
    } finally {
      setEmailSubmitting(false);
    }
  }

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-[#F4F7FF] p-10">
        <p className="text-sm text-muted">Loading…</p>
      </div>
    );
  }
  if (error && !data) {
    return (
      <div className="min-h-screen bg-[#F4F7FF] p-10">
        <Link to="/admin/bookings-documents" className="text-sm text-accent hover:underline">
          ← Back to Bookings & Documents
        </Link>
        <p className="mt-4 text-sm text-[#a5162d]">{error}</p>
      </div>
    );
  }

  const { booking, travelers, voucher } = data;
  // Purely informational now — whether the agent's already gotten the
  // one-time "documents ready" notification/email, not a gate on anything
  // (every upload is downloadable by the agent immediately regardless).
  const agentNotified = !!booking.documentsNotifiedAt;
  const hasAnyDocument = travelers.some((t) => t.passportScanUploaded || t.passportPhotoUploaded || t.visaCopyUploaded) || voucher.uploaded;

  return (
    <div className="min-h-screen bg-[#F4F7FF]">
      <div className="mx-auto max-w-6xl p-6 lg:p-10">
        <Link to="/admin/bookings-documents" className="text-sm text-accent hover:underline">
          ← Back to Bookings & Documents
        </Link>

        <div className="mt-3 mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold">{booking.packageTitle}</h2>
            <p className="mt-1 text-sm text-muted">
              {booking.agencyName} · {new Date(booking.departureDate).toLocaleDateString()}
              {booking.departureLocation && ` · Ex-${booking.departureLocation}`}
            </p>
          </div>
          <Badge tone={agentNotified ? 'green' : 'grey'}>{agentNotified ? 'Agent notified' : 'Awaiting documents'}</Badge>
        </div>

        <Card label="Actions" className="mb-5 border-white">
          <div className="flex flex-wrap gap-2">
            <Button disabled={!hasAnyDocument || downloading} onClick={handleDownloadAll}>
              {downloading === `/admin/bookings/${bookingId}/documents/download-all` ? 'Preparing ZIP…' : 'Download All (ZIP)'}
            </Button>
            <Button disabled={!hasAnyDocument} onClick={() => setEmailOpen(true)}>
              Email to Supplier
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted">
            Visa copies and the voucher become downloadable to the agent automatically as soon as you upload them below — no
            separate release step. They're notified in-app and by email the first time anything's ready.
          </p>
        </Card>

        <Card label="Travelers & Documents" className="mb-5 border-white">
          <Table
            columns={['Traveler', 'Passport Scan', 'Passport Photo', 'Visa Copy', 'Upload Visa']}
            rows={travelers}
            renderRow={(t) => (
              <tr key={t.travelerId} className="border-b border-line-light last:border-0 align-top">
                <td className="px-3 py-3 font-semibold">{t.name}</td>
                <td className="px-3 py-3">
                  <div className="space-y-1.5">
                    <DocStatus uploaded={t.passportScanUploaded} label="Scan" />
                    {t.passportScanUploaded && (
                      <button
                        type="button"
                        className="block text-[11px] text-accent hover:underline"
                        onClick={() =>
                          handleDownload(`/admin/bookings/${bookingId}/travelers/${t.travelerId}/documents/passport_scan/download`)
                        }
                      >
                        Download
                      </button>
                    )}
                  </div>
                </td>
                <td className="px-3 py-3">
                  <div className="space-y-1.5">
                    <DocStatus uploaded={t.passportPhotoUploaded} label="Photo" />
                    {t.passportPhotoUploaded && (
                      <button
                        type="button"
                        className="block text-[11px] text-accent hover:underline"
                        onClick={() =>
                          handleDownload(`/admin/bookings/${bookingId}/travelers/${t.travelerId}/documents/passport_photo/download`)
                        }
                      >
                        Download
                      </button>
                    )}
                  </div>
                </td>
                <td className="px-3 py-3">
                  <div className="space-y-1.5">
                    <DocStatus uploaded={t.visaCopyUploaded} label="Visa" />
                    {t.visaCopyUploaded && (
                      <button
                        type="button"
                        className="block text-[11px] text-accent hover:underline"
                        onClick={() =>
                          handleDownload(`/admin/bookings/${bookingId}/travelers/${t.travelerId}/documents/visa_copy/download`)
                        }
                      >
                        Download
                      </button>
                    )}
                  </div>
                </td>
                <td className="px-3 py-3">
                  <VisaUploadInline
                    bookingId={bookingId}
                    travelerId={t.travelerId}
                    uploaded={t.visaCopyUploaded}
                    onUploaded={loadDetail}
                  />
                </td>
              </tr>
            )}
          />
        </Card>

        <Card label="Booking Voucher" className="mb-5 border-white">
          <div className="flex flex-wrap items-center gap-3">
            <DocStatus uploaded={voucher.uploaded} label="Voucher" />
            {voucher.uploaded && (
              <button
                type="button"
                className="text-xs text-accent hover:underline"
                onClick={() => handleDownload(`/admin/bookings/${bookingId}/voucher/download`)}
              >
                Download
              </button>
            )}
          </div>
          <div className="mt-3 max-w-sm">
            <ImageUpload
              value={voucher.uploaded ? 'uploaded' : ''}
              onChange={() => {}}
              onUpload={uploadVoucher}
              acceptedTypes={DOC_ACCEPTED_TYPES}
              acceptHint="JPG, PNG, WebP, or PDF"
            />
          </div>
        </Card>
      </div>

      {emailOpen && (
        <Modal
          title="Email Documents to Supplier"
          onClose={() => setEmailOpen(false)}
          footer={
            <>
              <Button onClick={() => setEmailOpen(false)}>Cancel</Button>
              <Button variant="accent" disabled={emailSubmitting} onClick={handleSendEmail}>
                {emailSubmitting ? 'Sending…' : 'Send'}
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <div>
              <FieldLabel>Supplier / visa-authority email</FieldLabel>
              <TextInput type="email" value={emailTo} onChange={(e) => setEmailTo(e.target.value)} placeholder="supplier@example.com" />
            </div>
            <div>
              <FieldLabel>Message (optional)</FieldLabel>
              <Textarea rows={3} value={emailMessage} onChange={(e) => setEmailMessage(e.target.value)} />
            </div>
            <div>
              <FieldLabel>Documents to attach</FieldLabel>
              <div className="space-y-1.5">
                {travelers.map((t) => (
                  <div key={t.travelerId} className="rounded-md border border-line-light p-2">
                    <div className="mb-1 text-xs font-semibold">{t.name}</div>
                    {t.passportScanUploaded && (
                      <Checkbox
                        checked={isRefSelected({ type: 'passport_scan', travelerId: t.travelerId })}
                        onChange={() => toggleRef({ type: 'passport_scan', travelerId: t.travelerId })}
                        label="Passport scan"
                      />
                    )}
                    {t.passportPhotoUploaded && (
                      <Checkbox
                        checked={isRefSelected({ type: 'passport_photo', travelerId: t.travelerId })}
                        onChange={() => toggleRef({ type: 'passport_photo', travelerId: t.travelerId })}
                        label="Passport photo"
                      />
                    )}
                    {t.visaCopyUploaded && (
                      <Checkbox
                        checked={isRefSelected({ type: 'visa_copy', travelerId: t.travelerId })}
                        onChange={() => toggleRef({ type: 'visa_copy', travelerId: t.travelerId })}
                        label="Visa copy"
                      />
                    )}
                    {!t.passportScanUploaded && !t.passportPhotoUploaded && !t.visaCopyUploaded && (
                      <p className="text-[11px] text-muted">No documents uploaded yet.</p>
                    )}
                  </div>
                ))}
                {voucher.uploaded && (
                  <div className="rounded-md border border-line-light p-2">
                    <Checkbox
                      checked={isRefSelected({ type: 'voucher' })}
                      onChange={() => toggleRef({ type: 'voucher' })}
                      label="Booking voucher"
                    />
                  </div>
                )}
              </div>
            </div>
            <ErrorText>{emailError}</ErrorText>
          </div>
        </Modal>
      )}
    </div>
  );
}
