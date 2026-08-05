import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { Button, Card, ErrorText, Tag, TextInput } from '../components/ui.jsx';

const CASHFREE_SDK_URL = 'https://sdk.cashfree.com/js/v3/cashfree.js';

function loadCashfreeSdk() {
  if (window.Cashfree) return Promise.resolve(window.Cashfree);
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = CASHFREE_SDK_URL;
    script.onload = () => resolve(window.Cashfree);
    script.onerror = () => reject(new Error('Unable to load the payment gateway'));
    document.body.appendChild(script);
  });
}

function CardPanel({ booking }) {
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handlePay() {
    setError('');
    setSubmitting(true);
    try {
      const { paymentSessionId } = await api.post('/payments/cashfree/create-order', {
        bookingId: booking.id,
        amount: booking.balanceDue,
      });
      const Cashfree = await loadCashfreeSdk();
      const cashfree = Cashfree({ mode: 'sandbox' });
      cashfree.checkout({ paymentSessionId, redirectTarget: '_self' });
    } catch (err) {
      setError(err.message || 'Unable to start payment');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card label="Option A — Payment Gateway" className="border-white">
      <p className="mb-3 text-xs text-agent-muted">
        You'll be redirected to Cashfree's secure checkout to complete card payment.
      </p>
      <ErrorText>{error}</ErrorText>
      <Button variant="accent" className="w-full" disabled={submitting} onClick={handlePay}>
        {submitting ? 'Starting checkout…' : `Pay ₹${booking.balanceDue} Now`}
      </Button>
    </Card>
  );
}

function NeftPanel({ booking }) {
  const [reference, setReference] = useState('');
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) {
      setError('Upload the NEFT transfer slip');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('slip', file);
      formData.append('amount', String(booking.balanceDue));
      formData.append('reference', reference);
      await api.postForm(`/payments/${booking.id}/neft-slip`, formData);
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Unable to submit slip');
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <Card label="Option B — NEFT / Bank Transfer" className="border-white">
        <p className="text-sm font-semibold text-[#227647]">Slip submitted for verification.</p>
        <p className="mt-1 text-xs text-agent-muted">Booking confirms once admin verifies the slip.</p>
      </Card>
    );
  }

  return (
    <Card label="Option B — NEFT / Bank Transfer" className="border-white">
      <div className="mb-3 space-y-1 text-xs leading-relaxed">
        <div>Bank: Bank Muscat · A/C: 0123456789 · IFSC/Swift: BMUSOMRXXXX</div>
        <div>
          Reference to booking: <b>{booking.id.slice(0, 8)}</b>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <TextInput
          placeholder="Slip reference number"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
        />
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="w-full rounded-md border border-agent-line-light bg-white px-3 py-2 text-xs"
        />
        <ErrorText>{error}</ErrorText>
        <Button variant="accent" type="submit" className="w-full" disabled={submitting}>
          {submitting ? 'Submitting…' : 'Submit Slip for Verification'}
        </Button>
      </form>
    </Card>
  );
}

export default function Payment() {
  const { bookingId } = useParams();
  const [booking, setBooking] = useState(null);
  const [method, setMethod] = useState('card');
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get(`/bookings/${bookingId}`)
      .then(({ booking: b }) => setBooking(b))
      .catch((err) => setError(err.message));
  }, [bookingId]);

  if (error) {
    return (
      <div className="mx-auto max-w-xl p-8">
        <ErrorText>{error}</ErrorText>
      </div>
    );
  }
  if (!booking) {
    return <div className="p-8 text-sm text-agent-muted">Loading…</div>;
  }

  return (
    <div className="mx-auto max-w-xl p-5 lg:p-8">
      <Link to="/agent/dashboard" className="mb-4 inline-block text-xs text-agent-muted hover:text-agent-ink">
        ← Back to dashboard
      </Link>
      <h2 className="mb-4 text-xl font-bold text-agent-ink">Payment</h2>

      <Card label="Amount due" className="mb-4 border-white">
        <div className="flex justify-between text-sm">
          <span>Deposit due now</span>
          <b>₹{booking.balanceDue}</b>
        </div>
        <div className="mt-1 text-xs text-agent-muted">Total booking value: ₹{booking.totalPrice}</div>
      </Card>

      <div className="mb-4 flex gap-2">
        <button onClick={() => setMethod('card')}>
          <Tag active={method === 'card'}>Pay by Card</Tag>
        </button>
        <button onClick={() => setMethod('neft')}>
          <Tag active={method === 'neft'}>Pay via NEFT</Tag>
        </button>
      </div>

      {method === 'card' ? <CardPanel booking={booking} /> : <NeftPanel booking={booking} />}
    </div>
  );
}
