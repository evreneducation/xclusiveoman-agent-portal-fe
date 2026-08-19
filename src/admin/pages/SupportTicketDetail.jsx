import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { useToast } from '../../shared/components/ToastProvider.jsx';
import { Badge, Button, Card, ErrorText, FieldLabel, Select, TextInput } from '../components/ui.jsx';

// Admin Support & Helpdesk (Task 18) — ticket detail: status controls,
// assignment, threaded replies, activity history. Mirrors
// OperationsDetail.jsx's own "load once, refetch after any write" pattern.

const STATUS_OPTIONS = ['open', 'in_progress', 'resolved'];
const STATUS_TONE = { open: 'amber', in_progress: 'teal', resolved: 'green' };
const PRIORITY_TONE = { low: 'grey', normal: 'teal', high: 'red' };

function AssignmentCard({ ticket, onUpdated }) {
  const toast = useToast();
  const [candidates, setCandidates] = useState([]);
  const [selected, setSelected] = useState(ticket.assignedToUserId || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/admin/support/tickets/assignment-candidates')
      .then(({ staff }) => setCandidates(staff))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setSelected(ticket.assignedToUserId || '');
  }, [ticket.assignedToUserId]);

  async function handleAssign() {
    setError('');
    setSubmitting(true);
    try {
      await api.patch(`/admin/support/tickets/${ticket.id}`, { assignedToUserId: selected || null });
      toast.success('Assignment updated.');
      onUpdated();
    } catch (err) {
      setError(err.message || 'Unable to assign ticket');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card label="Assignment" className="border-white">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1">
          <FieldLabel>Assign to support staff</FieldLabel>
          <Select value={selected} onChange={(e) => setSelected(e.target.value)}>
            <option value="">Unassigned</option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.fullName} — {c.role.replace(/_/g, ' ')}
              </option>
            ))}
          </Select>
        </div>
        <Button variant="accent" disabled={submitting} onClick={handleAssign}>
          {submitting ? 'Saving…' : 'Save Assignment'}
        </Button>
      </div>
      <ErrorText>{error}</ErrorText>
    </Card>
  );
}

function StatusCard({ ticket, onUpdated }) {
  const toast = useToast();
  const [submitting, setSubmitting] = useState('');

  async function handleSetStatus(status) {
    setSubmitting(status);
    try {
      await api.patch(`/admin/support/tickets/${ticket.id}`, { status });
      toast.success('Status updated.');
      onUpdated();
    } catch (err) {
      toast.error(err.message || 'Unable to change status');
    } finally {
      setSubmitting('');
    }
  }

  return (
    <Card label="Status" className="border-white">
      <div className="flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((s) => (
          <Button
            key={s}
            variant={ticket.status === s ? 'accent' : 'default'}
            disabled={ticket.status === s || submitting}
            onClick={() => handleSetStatus(s)}
          >
            {submitting === s ? 'Saving…' : s.replace(/_/g, ' ')}
          </Button>
        ))}
      </div>
    </Card>
  );
}

function Thread({ ticketId, messages, onReplied }) {
  const toast = useToast();
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleReply() {
    if (!message.trim()) return;
    setError('');
    setSubmitting(true);
    try {
      await api.post(`/admin/support/tickets/${ticketId}/messages`, { message: message.trim() });
      setMessage('');
      toast.success('Reply sent.');
      onReplied();
    } catch (err) {
      setError(err.message || 'Unable to send reply');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card label="Conversation" className="border-white">
      {messages.length === 0 ? (
        <p className="text-sm text-muted">No replies yet.</p>
      ) : (
        <div className="mb-3 space-y-2">
          {messages.map((m) => (
            <div key={m.id} className="rounded-lg bg-panel px-3 py-2 text-sm">
              <div className="mb-0.5 flex items-center justify-between text-[10px] text-muted">
                <span className="font-semibold">
                  {m.senderName} <span className="font-normal">({m.senderRole?.replace(/_/g, ' ')})</span>
                </span>
                <span>{new Date(m.createdAt).toLocaleString()}</span>
              </div>
              {m.message}
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <TextInput placeholder="Type a reply…" value={message} onChange={(e) => setMessage(e.target.value)} />
        <Button variant="accent" disabled={submitting || !message.trim()} onClick={handleReply}>
          {submitting ? 'Sending…' : 'Reply'}
        </Button>
      </div>
      <ErrorText>{error}</ErrorText>
    </Card>
  );
}

function ActivityHistory({ activity }) {
  return (
    <Card label="Activity History" className="border-white">
      {activity.length === 0 ? (
        <p className="text-sm text-muted">No activity recorded yet.</p>
      ) : (
        <div className="space-y-2">
          {activity.map((a, i) => (
            <div key={i} className="flex items-start justify-between border-b border-line-light py-2 text-xs last:border-0">
              <span className="text-ink">{a.description}</span>
              <span className="flex-none pl-3 text-right text-muted">
                {new Date(a.at).toLocaleString()}
                {a.by && <div>{a.by}</div>}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export default function SupportTicketDetail() {
  const { ticketId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  function loadDetail() {
    setLoading(true);
    setError('');
    return api
      .get(`/admin/support/tickets/${ticketId}`)
      .then(setData)
      .catch((err) => setError(err.message || 'Unable to load this ticket'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-[#F4F7FF] p-10">
        <p className="text-sm text-muted">Loading…</p>
      </div>
    );
  }
  if (error && !data) {
    return (
      <div className="min-h-screen bg-[#F4F7FF] p-10">
        <Link to="/admin/support" className="text-sm text-accent hover:underline">
          ← Back to Support &amp; Helpdesk
        </Link>
        <p className="mt-4 text-sm text-[#a5162d]">{error}</p>
      </div>
    );
  }

  const { ticket, messages, activity } = data;

  return (
    <div className="min-h-screen bg-[#F4F7FF]">
      <div className="mx-auto max-w-5xl p-6 lg:p-10">
        <Link to="/admin/support" className="text-sm text-accent hover:underline">
          ← Back to Support &amp; Helpdesk
        </Link>

        <div className="mt-3 mb-5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-3xl font-bold">{ticket.subject}</h2>
            <Badge tone={PRIORITY_TONE[ticket.priority] || 'grey'}>{ticket.priority}</Badge>
            <Badge tone={STATUS_TONE[ticket.status] || 'grey'}>{ticket.status.replace(/_/g, ' ')}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted">
            {ticket.agencyName} · Raised by {ticket.createdByName} ({ticket.createdByEmail}) ·{' '}
            {new Date(ticket.createdAt).toLocaleDateString()}
          </p>
        </div>

        <Card label="Description" className="mb-5 border-white">
          <p className="text-sm text-ink">{ticket.description}</p>
        </Card>

        <div className="mb-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
          <StatusCard ticket={ticket} onUpdated={loadDetail} />
          <AssignmentCard ticket={ticket} onUpdated={loadDetail} />
        </div>

        <div className="mb-5">
          <Thread ticketId={ticket.id} messages={messages} onReplied={loadDetail} />
        </div>

        <ActivityHistory activity={activity} />
      </div>
    </div>
  );
}
