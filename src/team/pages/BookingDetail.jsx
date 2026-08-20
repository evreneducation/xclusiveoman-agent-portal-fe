import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { Badge, Button, Card, ErrorText } from '../components/ui.jsx';

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

const DOC_TYPES = [
  { type: 'passport_scan', label: 'Passport Scan', uploadedKey: 'passportScanUploaded' },
  { type: 'passport_photo', label: 'Passport Photo', uploadedKey: 'passportPhotoUploaded' },
  { type: 'visa_copy', label: 'Visa Copy', uploadedKey: 'visaCopyUploaded' },
];

export default function BookingDetail() {
  const { id } = useParams();
  const [booking, setBooking] = useState(null);
  const [travelers, setTravelers] = useState([]);
  const [voucher, setVoucher] = useState(null);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState('');

  useEffect(() => {
    api
      .get(`/admin/bookings/${id}/documents`)
      .then((data) => {
        setBooking(data.booking);
        setTravelers(data.travelers || []);
        setVoucher(data.voucher);
      })
      .catch((err) => setError(err.message || 'Unable to load booking'));
  }, [id]);

  async function handleDownload(path, filename) {
    setDownloading(path);
    setError('');
    try {
      const blob = await api.getBlob(path);
      triggerDownload(blob, filename);
    } catch (err) {
      setError(err.message || 'Unable to download this document');
    } finally {
      setDownloading('');
    }
  }

  if (!booking) return <p className="p-10 text-xs text-team-muted">{error || 'Loading…'}</p>;

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-6 lg:p-10">
      <Link to="/team/bookings-docs" className="text-xs font-semibold text-team-accent-dark hover:underline">
        ← Back to Bookings & Docs
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-team-ink">{booking.agencyName}</h2>
          <p className="mt-1 text-sm text-team-muted">{booking.packageTitle}</p>
        </div>
        <Badge tone={booking.status === 'confirmed' ? 'green' : 'grey'}>{booking.status}</Badge>
      </div>

      <ErrorText>{error}</ErrorText>

      <Card label="Departure">
        <p className="text-sm text-team-ink">
          {booking.departureDate} · {booking.departureLocation}
        </p>
      </Card>

      <Card label={`Voucher`}>
        {voucher?.uploaded ? (
          <Button
            variant="accent"
            disabled={downloading === `/admin/bookings/${id}/voucher/download`}
            onClick={() => handleDownload(`/admin/bookings/${id}/voucher/download`, 'voucher')}
          >
            {downloading === `/admin/bookings/${id}/voucher/download` ? 'Downloading…' : 'Download Voucher'}
          </Button>
        ) : (
          <p className="text-xs text-team-muted">No voucher uploaded yet.</p>
        )}
      </Card>

      <Card label={`Travelers (${travelers.length})`}>
        <div className="space-y-3">
          {travelers.map((t) => (
            <div key={t.travelerId} className="rounded-lg border border-team-line-light bg-team-panel p-3">
              <div className="text-sm font-bold text-team-ink">{t.name}</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {DOC_TYPES.map((d) => {
                  const path = `/admin/bookings/${id}/travelers/${t.travelerId}/documents/${d.type}/download`;
                  return t[d.uploadedKey] ? (
                    <Button key={d.type} disabled={downloading === path} onClick={() => handleDownload(path, `${d.type}_${t.name}`)}>
                      {downloading === path ? 'Downloading…' : d.label}
                    </Button>
                  ) : (
                    <span key={d.type} className="rounded-md border border-team-line-light bg-white px-3 py-2 text-[11px] text-team-muted">
                      {d.label} — not uploaded
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
          {travelers.length === 0 && <p className="text-xs text-team-muted">No travelers on this booking.</p>}
        </div>
      </Card>
    </div>
  );
}
