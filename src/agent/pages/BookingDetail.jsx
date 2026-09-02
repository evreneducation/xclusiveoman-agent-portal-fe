import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { getSocket } from '../lib/socket.js';
import { useAuth } from '../context/AuthContext.jsx';
import { LuDownload } from 'react-icons/lu';
import { Badge, Button, Card, ErrorText } from '../components/ui.jsx';
import { ImageUpload } from '../../shared/components/ImageUpload.jsx';
import { downloadDocument } from '../../shared/documents/downloadDocument.js';

// Agent Traveler Document Upload (Task 14 — DOC-1/DOC-6). "After a booking
// is confirmed, travelers become uploadable"; admin-provided visa/voucher
// documents are downloadable automatically as soon as the admin uploads
// them — no separate release step (see travelerDocumentsAdmin.controller.js's
// own comment on the backend).

// Same accept list every other passport/document picker in this app uses
// (admin's own VisaUploadInline, NEFT slip upload, etc.).
const DOC_ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

// A small pill-style download link, not a bare underlined text link — used
// right under each upload field (so "download the scan" reads as belonging
// to the scan field above it, not as a loose row of three unrelated actions
// at the bottom of the card) and for the visa copy below.
function DownloadLink({ label, downloading, onClick }) {
  return (
    <button
      type="button"
      disabled={downloading}
      onClick={onClick}
      className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-agent-line-light bg-agent-panel px-3 py-1.5 text-[11px] font-semibold text-agent-ink transition-colors hover:border-agent-accent hover:bg-agent-accent-soft disabled:cursor-not-allowed disabled:opacity-60"
    >
      <LuDownload size={12} className="flex-none" />
      {downloading ? 'Downloading…' : label}
    </button>
  );
}

function TravelerUploadCard({ bookingId, traveler, onUploaded }) {
  const [error, setError] = useState('');
  const [downloadingType, setDownloadingType] = useState('');

  // ImageUpload's `value` is normally a URL it previews as a thumbnail — the
  // real Cloudinary URL is deliberately never sent to the agent (only
  // booleans like passportScanUploaded), so 'uploaded' is a plain non-image
  // sentinel: ImageUpload falls back to its generic document-icon chip +
  // "Change file" affordance for any value it can't render as an <img>,
  // which is exactly the "already have one, replace it" state this needs.
  async function uploadField(fieldName, file) {
    const formData = new FormData();
    formData.append(fieldName, file);
    await api.postForm(`/bookings/${bookingId}/travelers/${traveler.travelerId}/documents`, formData);
    onUploaded();
    return 'uploaded';
  }

  async function handleDownload(type) {
    setError('');
    setDownloadingType(type);
    try {
      await downloadDocument(api, `/bookings/${bookingId}/travelers/${traveler.travelerId}/documents/${type}/download`);
    } catch (err) {
      setError(err.message || 'Unable to download this document');
    } finally {
      setDownloadingType('');
    }
  }

  return (
    <Card className="border-white">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-bold text-agent-ink">{traveler.name}</div>
        <div className="flex gap-1.5">
          <Badge tone={traveler.passportScanUploaded ? 'green' : 'grey'}>Scan {traveler.passportScanUploaded ? '✓' : '—'}</Badge>
          <Badge tone={traveler.passportPhotoUploaded ? 'green' : 'grey'}>Photo {traveler.passportPhotoUploaded ? '✓' : '—'}</Badge>
          <Badge tone={traveler.visaCopyDownloadable ? 'green' : 'grey'}>Visa {traveler.visaCopyDownloadable ? 'Ready' : '—'}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <ImageUpload
            label="Passport scan"
            value={traveler.passportScanUploaded ? 'uploaded' : ''}
            onChange={() => {}}
            onUpload={(file) => uploadField('passportScan', file)}
            acceptedTypes={DOC_ACCEPTED_TYPES}
            acceptHint="JPG, PNG, WebP, or PDF"
          />
          {traveler.passportScanUploaded && (
            <DownloadLink
              label="Download scan"
              downloading={downloadingType === 'passport_scan'}
              onClick={() => handleDownload('passport_scan')}
            />
          )}
        </div>
        <div>
          <ImageUpload
            label="Passport-size photo"
            value={traveler.passportPhotoUploaded ? 'uploaded' : ''}
            onChange={() => {}}
            onUpload={(file) => uploadField('passportPhoto', file)}
            acceptedTypes={DOC_ACCEPTED_TYPES}
            acceptHint="JPG, PNG, WebP, or PDF"
          />
          {traveler.passportPhotoUploaded && (
            <DownloadLink
              label="Download photo"
              downloading={downloadingType === 'passport_photo'}
              onClick={() => handleDownload('passport_photo')}
            />
          )}
        </div>
      </div>

      {traveler.visaCopyDownloadable && (
        <div className="mt-4 border-t border-agent-line-light pt-3">
          <DownloadLink
            label="Download visa copy"
            downloading={downloadingType === 'visa_copy'}
            onClick={() => handleDownload('visa_copy')}
          />
        </div>
      )}
      <ErrorText>{error}</ErrorText>
    </Card>
  );
}

export default function BookingDetail() {
  const { bookingId } = useParams();
  const { socketConnected } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [voucherDownloading, setVoucherDownloading] = useState(false);
  const [voucherError, setVoucherError] = useState('');

  function loadDetail() {
    setLoading(true);
    setError('');
    return api
      .get(`/bookings/${bookingId}/documents`)
      .then(setData)
      .catch((err) => setError(err.message || 'Unable to load this booking'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  // Live refresh when a payment for this booking confirms (spec M) — the
  // status badge / upload-eligibility flip through without a manual reload.
  // Poll + REST remain the source of truth; this is just a fast nudge.
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return undefined;
    const onChange = (evt) => {
      if (evt?.bookingId === bookingId) loadDetail();
    };
    socket.on('payment:status_changed', onChange);
    socket.on('booking:status_changed', onChange);
    return () => {
      socket.off('payment:status_changed', onChange);
      socket.off('booking:status_changed', onChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId, socketConnected]);

  async function handleVoucherDownload() {
    setVoucherDownloading(true);
    setVoucherError('');
    try {
      await downloadDocument(api, `/bookings/${bookingId}/voucher/download`, 'voucher');
    } catch (err) {
      setVoucherError(err.message || 'Unable to download the voucher');
    } finally {
      setVoucherDownloading(false);
    }
  }

  if (loading && !data) {
    return (
      <div className="mx-auto max-w-4xl p-5 lg:p-8">
        <p className="text-sm text-agent-muted">Loading…</p>
      </div>
    );
  }
  if (error && !data) {
    return (
      <div className="mx-auto max-w-4xl p-5 lg:p-8">
        <Link to="/agent/bookings" className="text-sm text-agent-accent hover:underline">
          ← Back to Bookings
        </Link>
        <ErrorText>{error}</ErrorText>
      </div>
    );
  }

  const { booking, travelers, voucher } = data;

  return (
    <div className="mx-auto max-w-4xl p-5 lg:p-8">
      <Link to="/agent/bookings" className="text-sm text-agent-accent hover:underline">
        ← Back to Bookings
      </Link>

      <div className="mt-2 mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-agent-ink">Travel Documents</h2>
        <Badge tone={booking.status === 'fully_paid' || booking.status === 'confirmed' ? 'green' : 'amber'}>
          {booking.status.replace(/_/g, ' ')}
        </Badge>
      </div>

      {!booking.uploadEligible ? (
        <Card className="border-white">
          <p className="text-sm text-agent-muted">
            Traveler document upload will be available once this booking is confirmed. Please complete payment first.
          </p>
        </Card>
      ) : (
        <>
          <div className="space-y-4">
            {travelers.map((t) => (
              <TravelerUploadCard key={t.travelerId} bookingId={bookingId} traveler={t} onUploaded={loadDetail} />
            ))}
            {travelers.length === 0 && <p className="text-sm text-agent-muted">No travelers on this booking yet.</p>}
          </div>

          <Card label="Booking Voucher" className="mt-4 border-white">
            {voucher.downloadable ? (
              <Button disabled={voucherDownloading} onClick={handleVoucherDownload}>
                {voucherDownloading ? 'Downloading…' : 'Download Voucher'}
              </Button>
            ) : (
              <p className="text-sm text-agent-muted">Your voucher hasn't been uploaded yet.</p>
            )}
            <ErrorText>{voucherError}</ErrorText>
          </Card>
        </>
      )}
    </div>
  );
}
