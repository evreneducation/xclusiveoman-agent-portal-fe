import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { Button, Card, ErrorText } from '../components/ui.jsx';
import { usePaymentAttempt } from '../lib/usePaymentAttempt.js';
import { PaymentAttemptStatus } from '../components/PaymentAttemptStatus.jsx';

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
            {status === 'confirmed' && bookingId && (
              <Link to={`/agent/bookings/${bookingId}`}>
                <Button variant="accent">View booking</Button>
              </Link>
            )}
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
