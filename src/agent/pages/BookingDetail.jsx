import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { Badge, Button, Card, ErrorText } from '../components/ui.jsx';

// Agent Traveler Document Upload (Task 14 — DOC-1/DOC-6). "After a booking
// is confirmed, travelers become uploadable"; admin-provided visa/voucher
// documents stay locked ("Documents will be available once admin releases
// them") until the admin's explicit Notify Agent action.

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function TravelerUploadCard({ bookingId, traveler, onUploaded }) {
  const [scanFile, setScanFile] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [downloadingType, setDownloadingType] = useState('');

  async function handleUpload() {
    if (!scanFile && !photoFile) {
      setError('Choose a passport scan and/or a passport-size photo to upload.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const formData = new FormData();
      if (scanFile) formData.append('passportScan', scanFile);
      if (photoFile) formData.append('passportPhoto', photoFile);
      await api.postForm(`/bookings/${bookingId}/travelers/${traveler.travelerId}/documents`, formData);
      setScanFile(null);
      setPhotoFile(null);
      onUploaded();
    } catch (err) {
      setError(err.message || 'Unable to upload documents');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDownload(type, filename) {
    setDownloadingType(type);
    try {
      const blob = await api.getBlob(`/bookings/${bookingId}/travelers/${traveler.travelerId}/documents/${type}/download`);
      triggerDownload(blob, filename);
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
          <Badge tone={traveler.visaCopyDownloadable ? 'green' : traveler.visaCopyUploaded ? 'amber' : 'grey'}>
            Visa {traveler.visaCopyDownloadable ? 'Ready' : traveler.visaCopyUploaded ? 'Processing' : '—'}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-[11px] font-semibold text-agent-muted">Passport scan</label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={(e) => setScanFile(e.target.files?.[0] || null)}
            className="w-full text-xs"
          />
          {traveler.passportScanUploaded && (
            <button
              type="button"
              className="mt-1 text-[11px] text-agent-accent hover:underline"
              disabled={downloadingType === 'passport_scan'}
              onClick={() => handleDownload('passport_scan', `passport_scan_${traveler.name}`)}
            >
              {downloadingType === 'passport_scan' ? 'Downloading…' : 'Download uploaded scan'}
            </button>
          )}
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold text-agent-muted">Passport-size photo</label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
            className="w-full text-xs"
          />
          {traveler.passportPhotoUploaded && (
            <button
              type="button"
              className="mt-1 text-[11px] text-agent-accent hover:underline"
              disabled={downloadingType === 'passport_photo'}
              onClick={() => handleDownload('passport_photo', `passport_photo_${traveler.name}`)}
            >
              {downloadingType === 'passport_photo' ? 'Downloading…' : 'Download uploaded photo'}
            </button>
          )}
        </div>
      </div>

      <Button
        variant="accent"
        className="mt-3 !py-1.5 text-xs"
        disabled={submitting || (!scanFile && !photoFile)}
        onClick={handleUpload}
      >
        {submitting ? 'Uploading…' : 'Upload'}
      </Button>
      <ErrorText>{error}</ErrorText>

      {traveler.visaCopyDownloadable && (
        <button
          type="button"
          className="mt-2 block text-[11px] text-agent-accent hover:underline"
          disabled={downloadingType === 'visa_copy'}
          onClick={() => handleDownload('visa_copy', `visa_copy_${traveler.name}`)}
        >
          {downloadingType === 'visa_copy' ? 'Downloading…' : 'Download visa copy'}
        </button>
      )}
    </Card>
  );
}

export default function BookingDetail() {
  const { bookingId } = useParams();
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

  async function handleVoucherDownload() {
    setVoucherDownloading(true);
    setVoucherError('');
    try {
      const blob = await api.getBlob(`/bookings/${bookingId}/voucher/download`);
      triggerDownload(blob, 'voucher');
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
        <Link to="/bookings" className="text-sm text-agent-accent hover:underline">
          ← Back to Bookings
        </Link>
        <ErrorText>{error}</ErrorText>
      </div>
    );
  }

  const { booking, travelers, voucher } = data;

  return (
    <div className="mx-auto max-w-4xl p-5 lg:p-8">
      <Link to="/bookings" className="text-sm text-agent-accent hover:underline">
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
            {!booking.documentsUnlocked ? (
              <p className="text-sm text-agent-muted">
                Documents will be available once admin releases them. You'll be notified in-app and by email as soon as your
                visa copies and voucher are ready.
              </p>
            ) : voucher.downloadable ? (
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
