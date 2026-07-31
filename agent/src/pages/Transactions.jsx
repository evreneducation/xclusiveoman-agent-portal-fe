import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { Badge, Table } from '../components/ui.jsx';

const STATUS_TONE = { confirmed: 'green', pending: 'amber', failed: 'red' };

export default function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/agencies/me/transactions')
      .then(({ transactions: list }) => setTransactions(list))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-[#eef1ef]">
      <div className="mx-auto max-w-4xl p-5 lg:p-8">
        <Link to="/dashboard" className="mb-4 inline-block text-xs text-muted hover:text-ink">
          ← Back to dashboard
        </Link>
        <h2 className="mb-4 text-2xl font-bold">Payment &amp; Transaction History</h2>

        {loading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : transactions.length === 0 ? (
          <p className="text-sm text-muted">No transactions yet.</p>
        ) : (
          <Table
            columns={['Date', 'Booking', 'Amount', 'Method', 'Status']}
            rows={transactions}
            renderRow={(t) => (
              <tr key={t.id} className="border-b border-line-light last:border-0">
                <td className="px-3 py-2">{new Date(t.createdAt).toLocaleDateString()}</td>
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
