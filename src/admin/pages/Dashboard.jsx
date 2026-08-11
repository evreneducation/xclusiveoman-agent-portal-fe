import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api/client.js';
import { Button, Card } from '../components/ui.jsx';

// Each stat reuses an existing list endpoint (no new backend routes) —
// counts only what's real: pending agency approvals, open FIT quote
// requests, and NEFT slips awaiting verification. The mockup's "Recent
// Activity" feed, "This month at a glance" revenue figures, and MICE
// breakdown aren't included since there's no activity-log or analytics API
// behind them yet (see the Analytics/placeholder pages).
function StatCard({ label, value, loading, hint, to }) {
  return (
    <Card className="border-white">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-2 text-3xl font-bold text-ink">{loading ? '—' : value}</div>
      {!loading && hint && (
        <Link to={to} className="mt-2 inline-block text-xs font-semibold text-accent hover:underline">
          {hint}
        </Link>
      )}
    </Card>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [pendingApprovals, setPendingApprovals] = useState(null);
  const [openQuotes, setOpenQuotes] = useState(null);
  const [neftPending, setNeftPending] = useState(null);

  useEffect(() => {
    api.get('/admin/agencies?status=pending').then((d) => setPendingApprovals(d.agencies.length));
    api.get('/admin/package-requests').then((d) => setOpenQuotes(d.pagination?.total ?? d.packageRequests.length));
    api.get('/admin/neft-verifications').then((d) => setNeftPending(d.payments.length));
  }, []);

  return (
    <div className="mx-auto max-w-6xl p-6 lg:p-10">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-ink">Dashboard</h2>
          <p className="mt-1 text-sm text-muted">
            Welcome back, {user?.fullName} <span className="text-muted/70">— {user?.role?.replace(/_/g, ' ')}</span>
          </p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Pending Approvals" value={pendingApprovals} loading={pendingApprovals == null} hint="Action needed →" to="/admin/approvals" />
        <StatCard label="FIT Quote Requests" value={openQuotes} loading={openQuotes == null} hint="Open Quote Inbox →" to="/admin/quote-inbox" />
        <StatCard label="NEFT Pending" value={neftPending} loading={neftPending == null} hint="Verify now →" to="/admin/neft-verification" />
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <Link to="/admin/bookings-documents">
          <Button variant="accent">+ Manual Booking</Button>
        </Link>
        <Link to="/admin/approvals">
          <Button>Review Agent Approvals</Button>
        </Link>
        <Link to="/admin/quote-inbox">
          <Button>Open Quote Inbox</Button>
        </Link>
      </div>

      <Card label="Quick links" className="border-white">
        <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <Link to="/admin/catalog" className="rounded-md border border-line-light px-3.5 py-2.5 hover:border-ink hover:bg-panel">
            Product Catalog
          </Link>
          <Link to="/admin/mice-catalog" className="rounded-md border border-line-light px-3.5 py-2.5 hover:border-ink hover:bg-panel">
            MICE Catalog
          </Link>
          <Link to="/admin/employees?tab=rm" className="rounded-md border border-line-light px-3.5 py-2.5 hover:border-ink hover:bg-panel">
            Relationship Managers
          </Link>
          <Link to="/admin/employees?tab=salesManager" className="rounded-md border border-line-light px-3.5 py-2.5 hover:border-ink hover:bg-panel">
            Sales Managers
          </Link>
          <Link to="/admin/transactions" className="rounded-md border border-line-light px-3.5 py-2.5 hover:border-ink hover:bg-panel">
            Transaction Ledger
          </Link>
          <Link to="/admin/neft-verification" className="rounded-md border border-line-light px-3.5 py-2.5 hover:border-ink hover:bg-panel">
            NEFT Verification
          </Link>
        </div>
      </Card>
    </div>
  );
}
