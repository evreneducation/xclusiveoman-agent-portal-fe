import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Badge, Button, Card, ErrorText, TextInput } from '../components/ui.jsx';

function PendingSlip({ payment, onDecided }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState('');

  async function decide(approve) {
    setError('');
    setSubmitting(approve ? 'approve' : 'reject');
    try {
      const { payment: updated } = await api.post(`/admin/payments/${payment.id}/verify`, {
        approve,
        reason: approve ? undefined : reason,
      });
      onDecided(updated);
    } catch (err) {
      setError(err.message || 'Unable to update payment');
    } finally {
      setSubmitting('');
    }
  }

  return (
    <Card label={`Pending slip — ${payment.agencyName}`} className="mb-4 border-white">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          {payment.neftSlipUrl ? (
            <a href={payment.neftSlipUrl} target="_blank" rel="noopener noreferrer">
              <img
                src={payment.neftSlipUrl}
                alt="NEFT slip"
                className="max-h-40 rounded-md border border-line-light object-contain"
                onError={(e) => (e.currentTarget.style.display = 'none')}
              />
              <div className="mt-1 text-xs text-accent hover:underline">View full slip</div>
            </a>
          ) : (
            <div className="flex h-24 items-center justify-center rounded-md border border-dashed border-line-light text-xs text-muted">
              No slip preview
            </div>
          )}
          <div className="mt-2 text-[10px] text-muted">
            Uploaded {new Date(payment.createdAt).toLocaleString()}
          </div>
        </div>
        <div className="space-y-2 text-sm">
          <div>
            Expected amount — <b>OMR {payment.amount}</b>
          </div>
          <div>Slip reference — {payment.neftReference || '—'}</div>
          <div>
            <TextInput
              placeholder="Reason (required to reject)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>
      </div>
      <ErrorText>{error}</ErrorText>
      <div className="mt-3 flex gap-2">
        <Button variant="accent" disabled={!!submitting} onClick={() => decide(true)}>
          {submitting === 'approve' ? 'Approving…' : 'Approve — Confirm Booking'}
        </Button>
        <Button variant="danger" disabled={!!submitting || !reason} onClick={() => decide(false)}>
          {submitting === 'reject' ? 'Rejecting…' : 'Reject — Notify Agent'}
        </Button>
      </div>
    </Card>
  );
}

export default function NeftVerification() {
  const { user, logout, socketConnected } = useAuth();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    api
      .get('/admin/neft-verifications')
      .then(({ payments: list }) => setPayments(list))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  function handleDecided(updated) {
    setPayments((list) => list.filter((p) => p.id !== updated.id));
  }

  return (
    <div className="min-h-screen bg-[#eef1ef]">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line-light bg-white/95 px-5 py-3 shadow-sm backdrop-blur">
        <div className="text-sm font-bold text-ink">Xclusive Oman Admin</div>
        <div className="flex items-center gap-3 text-xs">
          <Link to="/approvals" className="font-semibold text-ink hover:underline">
            Agent Approvals
          </Link>
          <Link to="/transactions" className="font-semibold text-ink hover:underline">
            Transaction Ledger
          </Link>
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full border border-line-light bg-panel"
            title={socketConnected ? 'Live connection active' : 'Connecting…'}
          >
            <span className={`h-2.5 w-2.5 rounded-full ${socketConnected ? 'bg-[#2f7d32]' : 'bg-[#ccc]'}`} />
          </div>
          <span>
            {user?.fullName} <span className="text-muted">({user?.role})</span>
          </span>
          <Button onClick={logout}>Log out</Button>
        </div>
      </div>

      <div className="mx-auto max-w-4xl p-5 lg:p-8">
        <h2 className="mb-4 text-2xl font-bold">NEFT Verification</h2>
        <Badge tone="amber" className="mb-4">
          {payments.length} pending
        </Badge>

        {loading && <p className="text-sm text-muted">Loading…</p>}
        {!loading && payments.length === 0 && <p className="text-sm text-muted">No slips awaiting verification.</p>}
        {payments.map((p) => (
          <PendingSlip key={p.id} payment={p} onDecided={handleDecided} />
        ))}
      </div>
    </div>
  );
}
