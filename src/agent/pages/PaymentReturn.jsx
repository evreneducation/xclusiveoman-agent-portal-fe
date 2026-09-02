import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { LuCheck } from 'react-icons/lu';
import { api } from '../api/client.js';
import { Button, Card, ErrorText } from '../components/ui.jsx';
import { usePaymentAttempt } from '../lib/usePaymentAttempt.js';
import { PaymentAttemptStatus } from '../components/PaymentAttemptStatus.jsx';

// A celebratory, full-bleed treatment for the one status that actually ends
// the flow successfully — takes over the whole page (no back link/heading
// above it, unlike every other status below) so the card itself fills the
// screen the way a "you're done" moment should, rather than sitting as a
// small compact block. Everything else (pending/awaiting/failed/cancelled)
// stays the plain compact PaymentAttemptStatus layout, since those are still
// mid-flow or need a retry action.
function PaymentConfirmedView({ bookingId }) {
  return (
    <div className="flex min-h-[calc(100vh-70px)] flex-col p-5 lg:p-8">
      <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-white bg-white/95 p-8 text-center shadow-[0_4px_16px_rgba(11,79,74,0.06)]">
        <h3 className="text-3xl font-bold text-agent-ink">Payment Confirmed!</h3>
        <div className="relative mx-auto my-8 flex h-48 w-48 items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-[#22C55E]/10" />
          <div className="absolute inset-5 rounded-full bg-[#22C55E]/15" />
          <div className="absolute inset-10 rounded-full bg-[#22C55E]/20" />
          <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-[#22C55E] shadow-lg shadow-[#22C55E]/30">
            <LuCheck size={40} strokeWidth={3} className="text-white" />
          </div>
        </div>
        <p className="text-sm text-agent-muted">Your Payment Has Been Received</p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          {bookingId && (
            <Link to={`/agent/bookings/${bookingId}`}>
              <Button variant="accent" className="!rounded-full px-6 py-2.5 text-sm">
                View Booking
              </Button>
            </Link>
          )}
          <Link to="/agent/bookings">
            <Button className="!rounded-full px-6 py-2.5 text-sm">My Bookings</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

// Cashfree redirects here after checkout (order_meta.return_url). It carries
// only the order_id, so step one is order_id -> paymentId; then the shared
// usePaymentAttempt hook polls GET /api/payments/:id (and listens on the
// socket) until the attempt is terminal — the browser redirect is never
// trusted on its own (spec I).
export default function PaymentReturn() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('order_id');

  const [attemptId, setAttemptId] = useState(null);
  const [resolving, setResolving] = useState(true);
  const [resolveError, setResolveError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function resolve() {
      setResolving(true);
      setResolveError('');
      try {
        if (orderId) {
          const { payment } = await api.get(`/payments/by-order/${encodeURIComponent(orderId)}`);
          if (!cancelled) setAttemptId(payment.id);
        } else {
          // Redirect arrived without order_id — fall back to the most recent
          // attempt the Payment page stashed.
          let last = null;
          try {
            const keys = Object.keys(window.sessionStorage).filter((k) => k.startsWith('pay:'));
            last = keys.map((k) => window.sessionStorage.getItem(k)).filter(Boolean).pop() || null;
          } catch {
            /* private mode */
          }
          if (last) setAttemptId(last);
          else setResolveError('No payment reference found. Check the payment from your booking.');
        }
      } catch (err) {
        if (!cancelled) {
          setResolveError(
            err.status === 404
              ? 'We couldn’t find that payment. Open it from your booking instead.'
              : err.message || 'Unable to look up this payment'
          );
        }
      } finally {
        if (!cancelled) setResolving(false);
      }
    }
    resolve();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const { payment } = usePaymentAttempt(attemptId);
  const status = payment?.status;
  const bookingId = payment?.bookingId;

  // Confirmed gets its own full-bleed page — no back link/heading, no
  // outer max-width cap or Card wrapper, since PaymentConfirmedView is
  // already the whole screen (see its own comment above).
  if (!resolving && !resolveError && status === 'confirmed') {
    return <PaymentConfirmedView bookingId={bookingId} />;
  }

  return (
    <div className="mx-auto max-w-xl p-5 lg:p-8">
      <Link to="/agent/bookings" className="mb-4 inline-block text-xs text-agent-muted hover:text-agent-ink">
        ← Back to Bookings
      </Link>
      <h2 className="mb-4 text-xl font-bold text-agent-ink">Payment status</h2>

      {resolving && <p className="text-sm text-agent-muted">Checking your payment…</p>}
      {resolveError && <ErrorText>{resolveError}</ErrorText>}

      {!resolving && !resolveError && (
        <Card className="border-white">
          {!status ? (
            <p className="text-sm text-agent-muted">Checking your payment…</p>
          ) : (
            <PaymentAttemptStatus status={status} />
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {(status === 'failed' || status === 'cancelled') && bookingId && (
              <Link to={`/agent/payments/${bookingId}`}>
                <Button variant="accent">Back to payment</Button>
              </Link>
            )}
            {(status === 'pending' || status === 'awaiting_payment' || status === 'awaiting_confirmation') &&
              bookingId && (
                <Link to={`/agent/payments/${bookingId}?attempt=${attemptId}`}>
                  <Button>Go to payment page</Button>
                </Link>
              )}
            <Link to="/agent/bookings">
              <Button>My bookings</Button>
            </Link>
          </div>
        </Card>
      )}
    </div>
  );
}
