import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { Badge, Card, ErrorText, TextInput } from '../components/ui.jsx';

const STATUS_TONE = { open: 'amber', in_progress: 'amber', resolved: 'green', closed: 'grey' };
const PRIORITY_TONE = { low: 'grey', medium: 'amber', high: 'red', urgent: 'red' };

// GET /admin/support/tickets — auto-scoped server-side to this RM's own
// agencies (supportTicketsAdmin.controller.js#listTickets).
export default function SupportTickets() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    api
      .get('/admin/support/tickets')
      .then((data) => setTickets(data.tickets || []))
      .catch((err) => setError(err.message || 'Unable to load tickets'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = tickets.filter((t) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (t.subject || '').toLowerCase().includes(q) || (t.agencyName || '').toLowerCase().includes(q);
  });

  return (
    <div className="mx-auto max-w-5xl p-6 lg:p-10">
      <h2 className="text-2xl font-bold text-team-ink">Support Tickets</h2>
      <p className="mt-1.5 text-sm text-team-muted">Helpdesk tickets raised by your agencies.</p>

      <TextInput placeholder="Search by subject or agency…" value={search} onChange={(e) => setSearch(e.target.value)} className="mt-5 max-w-sm" />

      {loading && <p className="mt-4 text-xs text-team-muted">Loading…</p>}
      <ErrorText>{error}</ErrorText>
      {!loading && filtered.length === 0 && !error && (
        <Card className="mt-4">
          <p className="text-sm text-team-muted">No support tickets from your agencies.</p>
        </Card>
      )}

      <div className="mt-4 space-y-3">
        {filtered.map((t) => (
          <Link key={t.id} to={`/team/support-tickets/${t.id}`}>
            <Card className="transition hover:-translate-y-0.5 hover:shadow-lg">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-bold text-team-ink">{t.subject}</div>
                  <p className="mt-1 text-xs text-team-muted">{t.agencyName} · {t.createdByName}</p>
                </div>
                <div className="flex flex-none gap-1.5">
                  <Badge tone={PRIORITY_TONE[t.priority] || 'grey'}>{t.priority}</Badge>
                  <Badge tone={STATUS_TONE[t.status] || 'grey'}>{t.status?.replace(/_/g, ' ')}</Badge>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
