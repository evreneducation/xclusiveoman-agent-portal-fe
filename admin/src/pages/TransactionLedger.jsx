import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Badge, Button, Select, Table } from '../components/ui.jsx';

const STATUS_TONE = { confirmed: 'green', pending: 'amber', failed: 'red', pending_verification: 'amber' };

export default function TransactionLedger() {
  const { user, logout, socketConnected } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [method, setMethod] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams();
    if (method) params.set('method', method);
    if (status) params.set('status', status);

    setLoading(true);
    api
      .get(`/admin/transactions?${params.toString()}`)
      .then(({ transactions: list }) => setTransactions(list))
      .finally(() => setLoading(false));
  }, [method, status]);

  return (
    <div className="min-h-screen bg-[#eef1ef]">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line-light bg-white/95 px-5 py-3 shadow-sm backdrop-blur">
        <div className="text-sm font-bold text-ink">Xclusive Oman Admin</div>
        <div className="flex items-center gap-3 text-xs">
          <Link to="/approvals" className="font-semibold text-ink hover:underline">
            Agent Approvals
          </Link>
          <Link to="/neft-verification" className="font-semibold text-ink hover:underline">
            NEFT Verification
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

      <div className="mx-auto max-w-5xl p-5 lg:p-8">
        <h2 className="mb-4 text-2xl font-bold">Transaction Ledger</h2>

        <div className="mb-4 flex flex-wrap gap-3">
          <Select className="max-w-[160px]" value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="">All methods</option>
            <option value="cashfree">Cashfree</option>
            <option value="neft">NEFT</option>
            <option value="credit_terms">Credit Terms</option>
          </Select>
          <Select className="max-w-[160px]" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="confirmed">Confirmed</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </Select>
        </div>

        {loading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : (
          <Table
            columns={['Date', 'Agency', 'Booking', 'Amount', 'Method', 'Status']}
            rows={transactions}
            renderRow={(t) => (
              <tr key={t.id} className="border-b border-line-light last:border-0">
                <td className="px-3 py-2">{new Date(t.createdAt).toLocaleDateString()}</td>
                <td className="px-3 py-2 font-semibold">{t.agencyName}</td>
                <td className="px-3 py-2 font-mono text-[10px]">{t.bookingId.slice(0, 8)}</td>
                <td className="px-3 py-2">OMR {t.amount}</td>
                <td className="px-3 py-2 uppercase">{t.method}</td>
                <td className="px-3 py-2">
                  <Badge tone={STATUS_TONE[t.status] || 'grey'}>{t.status}</Badge>
                </td>
              </tr>
            )}
          />
        )}
      </div>
    </div>
  );
}
