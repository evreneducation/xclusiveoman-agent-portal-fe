import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { Badge, Button, Card } from '../components/ui.jsx';

const TIER_LABEL = { gold: 'Gold', silver: 'Silver', bronze: 'Bronze' };

function RelationshipManagerCard({ rm }) {
  if (!rm) {
    return (
      <Card label="Your Relationship Manager" className="mb-5 border-white">
        <p className="text-sm text-agent-muted">
          No Relationship Manager assigned yet. One will be assigned by Xclusive Oman shortly.
        </p>
      </Card>
    );
  }

  const initials = rm.fullName
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="mb-5 flex items-start gap-4 rounded-xl border border-agent-line-light bg-white p-5 shadow-sm">
      <div className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-agent-ink text-sm font-bold text-white shadow-sm">
        {initials}
      </div>
      <div>
        <div className="mb-1 text-[10px] font-semibold uppercase text-agent-muted">
          Your Relationship Manager
        </div>
        <div className="text-base font-bold text-agent-ink">
          {rm.fullName} <span className="font-normal text-agent-muted">— Xclusive Oman</span>
        </div>
        <div className="mt-1 text-sm text-agent-muted">
          {rm.email} {rm.phone ? `· ${rm.phone}` : ''}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [agency, setAgency] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/agencies/me')
      .then(({ agency: a }) => setAgency(a))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div className="mx-auto max-w-6xl p-5 lg:p-8">
      {error && <p className="mb-5 rounded-lg border border-[#f2bdc6] bg-[#fff7f8] px-4 py-3 text-sm text-[#a5162d]">{error}</p>}

      <div className="mb-6 rounded-2xl border border-agent-line-light bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-agent-ink">{agency?.name || 'Your agency'}</h2>
            <p className="mt-2 text-sm text-agent-muted">
              Signed in as {user?.fullName} ({user?.email})
            </p>
          </div>
          {agency?.tier && <Badge tone="teal">{TIER_LABEL[agency.tier]}</Badge>}
        </div>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        <Link to="/agent/departures">
          <Button variant="accent">Browse Group Departures</Button>
        </Link>
        <Link to="/agent/package-builder">
          <Button>Build a Custom FIT Package</Button>
        </Link>
        <Link to="/agent/transactions">
          <Button>Payment &amp; Transaction History</Button>
        </Link>
      </div>

      <RelationshipManagerCard rm={agency?.relationshipManager} />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {['Open Quotes', 'Awaiting Pricing', 'Confirmed Bookings', 'Balance Due'].map((label) => (
          <Card key={label} label={label} className="min-h-28 border-white">
            <div className="text-2xl font-bold text-agent-muted">—</div>
            <div className="mt-2 text-xs text-agent-muted">coming soon</div>
          </Card>
        ))}
      </div>

      <Card label="Account status" className="border-white">
        <p className="text-sm text-agent-ink">
          Status:{' '}
          <span className="font-semibold">
            {agency?.status === 'approved' ? 'Approved' : agency?.status || 'Unknown'}
          </span>
        </p>
        {agency?.status !== 'approved' && (
          <p className="mt-2 text-sm text-agent-muted">
            Your agency is still pending approval — quotes, bookings and departures unlock once
            a Super Admin approves your account.
          </p>
        )}
      </Card>
    </div>
  );
}
