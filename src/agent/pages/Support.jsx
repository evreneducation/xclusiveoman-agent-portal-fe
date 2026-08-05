import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { Card, ErrorText } from '../components/ui.jsx';
import ComingSoon from '../components/ComingSoon.jsx';

// The RM contact card reuses GET /agencies/me (same call Dashboard.jsx
// already makes) — real data. Ticket raising has no backend yet (no
// /support/tickets routes in this build), so that half stays a placeholder.
function RelationshipManagerCard({ rm }) {
  if (!rm) {
    return (
      <Card label="Your Relationship Manager" className="border-white">
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
    <div className="flex items-start gap-4 rounded-xl border border-agent-line-light bg-white p-5 shadow-sm">
      <div className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-agent-ink text-sm font-bold text-white shadow-sm">
        {initials}
      </div>
      <div>
        <div className="mb-1 text-[10px] font-semibold uppercase text-agent-muted">Your Relationship Manager</div>
        <div className="text-base font-bold text-agent-ink">
          {rm.fullName} <span className="font-normal text-agent-muted">— Xclusive Oman</span>
        </div>
        <div className="mt-1 text-sm text-agent-muted">
          {rm.email} {rm.phone ? `· ${rm.phone}` : ''}
        </div>
        {rm.whatsappNumber && (
          <a
            href={`https://wa.me/${rm.whatsappNumber.replace(/[^\d]/g, '')}`}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-[#2f7d32] bg-[#eef7ee] px-3 py-1.5 text-[11px] font-semibold text-[#2f7d32]"
          >
            💬 Chat on WhatsApp
          </a>
        )}
      </div>
    </div>
  );
}

export default function Support() {
  const [agency, setAgency] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/agencies/me')
      .then(({ agency: a }) => setAgency(a))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-5 lg:p-8">
      <div>
        <h2 className="mb-1 text-2xl font-bold text-agent-ink">Contact &amp; Support</h2>
        <p className="text-sm text-agent-muted">Reach your Relationship Manager directly, or raise a support ticket.</p>
      </div>
      <ErrorText>{error}</ErrorText>
      {loading ? (
        <p className="text-sm text-agent-muted">Loading…</p>
      ) : (
        <RelationshipManagerCard rm={agency?.relationshipManager} />
      )}
      <ComingSoon title="Support tickets" description="Raise and track support tickets with our team." />
    </div>
  );
}
