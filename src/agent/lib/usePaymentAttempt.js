import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { getSocket } from './socket.js';
import { useAuth } from '../context/AuthContext.jsx';

// Terminal payment states (mirrors the backend's TERMINAL_PAYMENT_STATUSES) —
// once a payment reaches one of these the hook stops polling.
export const TERMINAL_PAYMENT_STATUSES = new Set(['confirmed', 'failed', 'cancelled', 'pending_verification']);

export function isTerminalPayment(status) {
  return TERMINAL_PAYMENT_STATUSES.has(status);
}

const POLL_MS = 4000;

/**
 * Reconciles one Cashfree payment attempt (spec I/J/L). Given a payment id it:
 *   - fetches GET /api/payments/:id on mount and on every re-entry to the page
 *     (pageshow / popstate / visibilitychange — i.e. browser Back/Forward and
 *     bfcache restore),
 *   - polls every ~4s while the attempt is non-terminal (missed/slow webhook
 *     fallback),
 *   - listens for the `payment:status_changed` Socket.IO event as a fast path,
 *   - stops all of the above once the attempt is terminal.
 *
 * All listeners/timers are cleaned up on unmount and when `attemptId` changes.
 */
export function usePaymentAttempt(attemptId) {
  const { socketConnected } = useAuth();
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(Boolean(attemptId));
  const attemptRef = useRef(attemptId);
  attemptRef.current = attemptId;

  const refetch = useCallback(async () => {
    const id = attemptRef.current;
    if (!id) return null;
    try {
      const { payment: p } = await api.get(`/payments/${id}`);
      // Guard against a stale response landing after attemptId changed.
      if (attemptRef.current === id) setPayment(p);
      return p;
    } catch {
      return null; // keep last known state; a later poll/socket tick retries
    } finally {
      if (attemptRef.current === id) setLoading(false);
    }
  }, []);

  // Initial fetch + reconcile-on-re-entry triggers.
  useEffect(() => {
    if (!attemptId) {
      setPayment(null);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    refetch();

    const onReenter = () => refetch();
    const onVisibility = () => {
      if (!document.hidden) refetch();
    };
    window.addEventListener('pageshow', onReenter);
    window.addEventListener('popstate', onReenter);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pageshow', onReenter);
      window.removeEventListener('popstate', onReenter);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [attemptId, refetch]);

  // Poll while non-terminal.
  useEffect(() => {
    if (!attemptId || !payment || isTerminalPayment(payment.status)) return undefined;
    const timer = setInterval(refetch, POLL_MS);
    return () => clearInterval(timer);
  }, [attemptId, payment, refetch]);

  // Fast path: Socket.IO status push for this exact attempt.
  useEffect(() => {
    if (!attemptId) return undefined;
    const socket = getSocket();
    if (!socket) return undefined;
    const onChange = (evt) => {
      if (evt?.paymentId === attemptId) refetch();
    };
    socket.on('payment:status_changed', onChange);
    return () => socket.off('payment:status_changed', onChange);
  }, [attemptId, refetch, socketConnected]);

  return { payment, loading, refetch, setPayment };
}
