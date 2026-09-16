import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { LuCreditCard, LuLandmark, LuShieldCheck } from 'react-icons/lu';
import { api } from '../api/client.js';
import { Button, Card, ErrorText, TextInput } from '../components/ui.jsx';
import { usePaymentAttempt } from '../lib/usePaymentAttempt.js';
import { PaymentAttemptStatus } from '../components/PaymentAttemptStatus.jsx';

// Card vs NEFT — a proper two-option selector (icon + name + a one-line
// distinguisher) rather than a pair of generic filter pills, since this is
// the one real decision this page asks the agent to make, not a filter over
// a list. `hint` is the thing that actually differs between the two
// (instant vs. manually verified), not a repeat of the label itself.
const PAYMENT_METHODS = [
  { key: 'card', label: 'Pay by Card', hint: 'Instant, via secure checkout', Icon: LuCreditCard },
  { key: 'neft', label: 'Pay via NEFT', hint: 'Bank transfer, verified manually', Icon: LuLandmark },
];

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

function newAttemptToken() {
  return window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// Card checkout with attempt reconciliation (spec J/K/L). The attempt id lives
// in both the URL (?attempt=) and sessionStorage so a browser Back/Forward or
// bfcache restore lands back here, reads it, and reconciles the real state via
// GET /api/payments/:id instead of blindly opening a second checkout.
function CardPanel({ booking, dueNow }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const storageKey = `pay:${booking.id}`;

  const storedAttempt =
    typeof window !== 'undefined' ? (() => { try { return window.sessionStorage.getItem(storageKey); } catch { return null; } })() : null;
  const attemptId = searchParams.get('attempt') || storedAttempt || null;

  const { payment, refetch } = usePaymentAttempt(attemptId);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(''); // '' | 'start' | 'cancel'

  const status = payment?.status;

  // A stored/URL attempt id is meant to reconcile a Back/Forward or bfcache
  // restore mid-checkout, not to be remembered forever — once it's actually
  // confirmed (e.g. the deposit succeeded) but a fresh amount is now due
  // (e.g. the remaining balance, opened via "Complete Payment"), that old
  // attempt no longer describes what a new click does. Drop it so the Pay
  // button reappears instead of permanently showing the old "confirmed".
  useEffect(() => {
    if (status !== 'confirmed' || !(dueNow > 0)) return;
    try {
      window.sessionStorage.removeItem(storageKey);
    } catch {
      /* private mode — nothing was persisted to clear */
    }
    const next = new URLSearchParams(searchParams);
    next.delete('attempt');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, dueNow]);

  function persistAttempt(id) {
    try {
      window.sessionStorage.setItem(storageKey, id);
    } catch {
      /* private mode — URL param still carries it */
    }
    const next = new URLSearchParams(searchParams);
    next.set('attempt', id);
    setSearchParams(next, { replace: true });
  }

  // "Pay" / "Resume" / "Try again" are the same call — the backend decides
  // whether to reuse the current active order or supersede a stale one; a
  // fresh token per click is the per-request idempotency key.
  async function startCheckout() {
    setError('');
    setBusy('start');
    try {
      const { paymentId, paymentSessionId } = await api.post('/payments/cashfree/create-order', {
        bookingId: booking.id,
        amount: dueNow,
        clientAttemptToken: newAttemptToken(),
      });
      if (paymentId) persistAttempt(paymentId);
      await refetch();
      if (!paymentSessionId) return; // reuse path with no fresh session (e.g. already paid)
      const Cashfree = await loadCashfreeSdk();
      Cashfree({ mode: 'sandbox' }).checkout({ paymentSessionId, redirectTarget: '_self' });
    } catch (err) {
      setError(err.message || 'Unable to start payment');
    } finally {
      setBusy('');
    }
  }

  async function cancelAttempt() {
    if (!attemptId) return;
    setError('');
    setBusy('cancel');
    try {
      await api.post(`/payments/${attemptId}/abort`);
      await refetch();
    } catch (err) {
      setError(err.message || 'Unable to cancel this attempt');
    } finally {
      setBusy('');
    }
  }

  return (
    <Card className="border-white">
      <div className="mb-1 flex items-center gap-1.5">
        <LuShieldCheck size={14} className="flex-none text-agent-accent-dark" />
        <span className="text-[11px] font-semibold uppercase text-agent-accent-dark">Secure checkout</span>
      </div>
      <p className="mb-4 text-xs text-agent-muted">
        You'll be redirected to Cashfree's secure checkout to complete card payment.
      </p>
      <ErrorText>{error}</ErrorText>

      {(status === 'pending' || status === 'awaiting_payment') && (
        <PaymentAttemptStatus
          status={status}
          actions={
            <>
              <Button variant="accent" disabled={!!busy} onClick={startCheckout}>
                {busy === 'start' ? 'Resuming…' : 'Resume'}
              </Button>
              <Button disabled={!!busy} onClick={cancelAttempt}>
                {busy === 'cancel' ? 'Cancelling…' : 'Cancel & start over'}
              </Button>
            </>
          }
        />
      )}

      {status === 'awaiting_confirmation' && <PaymentAttemptStatus status={status} />}

      {status === 'confirmed' && <PaymentAttemptStatus status={status} />}

      {(status === 'failed' || status === 'cancelled') && (
        <PaymentAttemptStatus
          status={status}
          actions={
            <Button variant="accent" disabled={!!busy} onClick={startCheckout}>
              {busy === 'start' ? 'Starting…' : 'Try again'}
            </Button>
          }
        />
      )}

      {!status && (
        <Button
          variant="accent"
          className="w-full !rounded-full py-3 text-sm"
          disabled={!!busy}
          onClick={startCheckout}
        >
          {busy === 'start' ? 'Starting checkout…' : `Pay ₹${dueNow} Now`}
        </Button>
      )}
    </Card>
  );
}

function NeftPanel({ booking, dueNow }) {
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
      formData.append('amount', String(dueNow));
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
      <Card className="border-white">
        <p className="text-sm font-semibold text-[#227647]">Slip submitted for verification.</p>
        <p className="mt-1 text-xs text-agent-muted">Booking confirms once admin verifies the slip.</p>
      </Card>
    );
  }

  return (
    <Card className="border-white">
      <div className="mb-4 rounded-lg border border-agent-line-light bg-agent-panel px-3.5 py-3 text-xs leading-relaxed text-agent-ink">
        <div>Bank: Bank Muscat · A/C: 0123456789 · IFSC/Swift: BMUSOMRXXXX</div>
        <div className="mt-1">
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
        <Button variant="accent" type="submit" className="w-full !rounded-full py-3 text-sm" disabled={submitting}>
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

  // booking.amountDueNow is the policy-scheduled amount (the flat deposit, or
  // the full price within 15 days of departure) — it's 0 once that's already
  // been paid, even if a balance still remains for later. If nothing is
  // scheduled due right now but the booking still carries an outstanding
  // balance (the deposit's already in and the agent opened this page via
  // "Complete Payment" to settle early), let them pay off that whole balance
  // instead of a non-actionable ₹0.
  const scheduledDueNow = booking.amountDueNow ?? booking.balanceDue;
  const outstandingBalance = booking.remainingBalance ?? Math.max(0, booking.balanceDue - scheduledDueNow);
  const dueNow = scheduledDueNow > 0 ? scheduledDueNow : outstandingBalance;
  const remaining = dueNow === scheduledDueNow ? outstandingBalance : 0;
  const isPartPayment = remaining > 0;

  return (
    <div className="mx-auto max-w-xl p-5 lg:p-8">
      <Link to="/agent/dashboard" className="mb-4 inline-block text-xs text-agent-muted hover:text-agent-ink">
        ← Back to dashboard
      </Link>
      <h2 className="mb-5 text-2xl font-bold text-agent-ink">Payment</h2>

      <Card className="mb-5 border-white">
        <div className="text-[11px] font-semibold uppercase text-agent-accent-dark">
          {isPartPayment ? 'Deposit due now' : 'Amount due now'}
        </div>
        <div className="mt-1 text-4xl font-extrabold text-agent-ink-dark">₹{dueNow}</div>

        {isPartPayment && (
          <div className="mt-4 flex items-center justify-between rounded-lg bg-agent-panel px-3.5 py-2.5 text-xs text-agent-muted">
            <span>Remaining balance, payable later</span>
            <span className="font-semibold text-agent-ink">₹{remaining}</span>
          </div>
        )}
        <div className="mt-3 flex items-center justify-between border-t border-agent-line-light pt-3 text-xs text-agent-muted">
          <span>Total booking value</span>
          <span className="font-semibold text-agent-ink">₹{booking.totalPrice}</span>
        </div>
        {isPartPayment && (
          <p className="mt-3 text-xs text-agent-muted">
            Your departure is more than 15 days away, so only a ₹{dueNow} deposit is needed now — the balance is
            collected closer to travel.
          </p>
        )}
      </Card>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {PAYMENT_METHODS.map(({ key, label, hint, Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setMethod(key)}
            className={`flex items-center gap-3 rounded-xl border px-4 py-3.5 text-left transition ${
              method === key
                ? 'border-agent-accent bg-agent-accent-soft'
                : 'border-agent-line-light bg-white hover:border-agent-line'
            }`}
          >
            <span
              className={`flex h-9 w-9 flex-none items-center justify-center rounded-full ${
                method === key ? 'bg-agent-accent text-agent-ink-dark' : 'bg-agent-panel text-agent-muted'
              }`}
            >
              <Icon size={17} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold text-agent-ink">{label}</span>
              <span className="block truncate text-[11px] text-agent-muted">{hint}</span>
            </span>
          </button>
        ))}
      </div>

      {method === 'card' ? <CardPanel booking={booking} dueNow={dueNow} /> : <NeftPanel booking={booking} dueNow={dueNow} />}
    </div>
  );
}
