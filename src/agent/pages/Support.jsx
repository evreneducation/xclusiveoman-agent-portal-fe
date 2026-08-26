import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { Badge, Button, Card, ErrorText, Select, TextInput } from '../components/ui.jsx';
import { RichTextEditor, RichTextDisplay, isEmptyHtml } from '../../shared/components/RichTextEditor.jsx';

// Agent Support & Helpdesk (Task 18 — Screen 27, SUP-1/SUP-3). RM contact
// card is unchanged/real (reuses GET /agencies/me, already live before this
// task). Ticket raising/list/thread below is new — backed by
// GET/POST /support/tickets and POST /support/tickets/:id/messages, which
// embeds each ticket's full message thread in the list response (no
// separate detail fetch — see supportTicketsAgent.controller.js's own
// comment on why).

const STATUS_TONE = { open: 'amber', in_progress: 'teal', resolved: 'green' };
const PRIORITY_TONE = { low: 'grey', normal: 'teal', high: 'red' };

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

function NewTicketForm({ onCreated }) {
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('normal');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    setError('');
    if (!subject.trim() || isEmptyHtml(description)) {
      setError('Subject and description are both required.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/support/tickets', { subject: subject.trim(), description, priority });
      setSubject('');
      setDescription('');
      setPriority('normal');
      onCreated();
    } catch (err) {
      setError(err.message || 'Unable to raise ticket');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card label="Raise a Support Ticket" className="border-white">
      <div className="space-y-2.5">
        <TextInput placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
        <RichTextEditor size="sm" value={description} onChange={setDescription} />
        <div className="flex items-center gap-2">
          <Select className="max-w-[160px]" value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="low">Low priority</option>
            <option value="normal">Normal priority</option>
            <option value="high">High priority</option>
          </Select>
          <Button variant="accent" disabled={submitting} onClick={handleSubmit}>
            {submitting ? 'Raising…' : 'Raise Ticket'}
          </Button>
        </div>
        <ErrorText>{error}</ErrorText>
      </div>
    </Card>
  );
}

function TicketThread({ ticket, onReplied }) {
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleReply() {
    if (!message.trim()) return;
    setError('');
    setSubmitting(true);
    try {
      await api.post(`/support/tickets/${ticket.id}/messages`, { message: message.trim() });
      setMessage('');
      onReplied();
    } catch (err) {
      setError(err.message || 'Unable to send reply');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-3 space-y-2 border-t border-agent-line-light pt-3">
      {ticket.messages.length === 0 ? (
        <p className="text-xs text-agent-muted">No replies yet.</p>
      ) : (
        ticket.messages.map((m) => (
          <div key={m.id} className="rounded-lg bg-agent-panel px-3 py-2 text-sm">
            <div className="mb-0.5 flex items-center justify-between text-[10px] text-agent-muted">
              <span className="font-semibold">{m.senderName}</span>
              <span>{new Date(m.createdAt).toLocaleString()}</span>
            </div>
            {m.message}
          </div>
        ))
      )}
      <div className="flex gap-2">
        <TextInput placeholder="Type a reply…" value={message} onChange={(e) => setMessage(e.target.value)} />
        <Button variant="accent" disabled={submitting || !message.trim()} onClick={handleReply}>
          {submitting ? 'Sending…' : 'Reply'}
        </Button>
      </div>
      <ErrorText>{error}</ErrorText>
    </div>
  );
}

function TicketCard({ ticket, expanded, onToggle, onReplied }) {
  return (
    <Card className="border-white">
      <button type="button" className="flex w-full items-start justify-between gap-3 text-left" onClick={onToggle}>
        <div>
          <div className="text-sm font-bold text-agent-ink">{ticket.subject}</div>
          <div className="mt-0.5 text-xs text-agent-muted">{new Date(ticket.createdAt).toLocaleDateString()}</div>
        </div>
        <div className="flex flex-none gap-1.5">
          <Badge tone={PRIORITY_TONE[ticket.priority] || 'grey'}>{ticket.priority}</Badge>
          <Badge tone={STATUS_TONE[ticket.status] || 'grey'}>{ticket.status.replace(/_/g, ' ')}</Badge>
        </div>
      </button>
      {expanded && (
        <>
          <RichTextDisplay html={ticket.description} className="mt-2 text-sm text-agent-ink" />
          <TicketThread ticket={ticket} onReplied={onReplied} />
        </>
      )}
    </Card>
  );
}

export default function Support() {
  const [agency, setAgency] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState([]);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  function loadTickets() {
    setTicketsLoading(true);
    return api
      .get('/support/tickets')
      .then(({ tickets: list }) => setTickets(list))
      .catch(() => {})
      .finally(() => setTicketsLoading(false));
  }

  useEffect(() => {
    api
      .get('/agencies/me')
      .then(({ agency: a }) => setAgency(a))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    loadTickets();
  }, []);

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-5 lg:p-8">
      <div>
        <h2 className="mb-1 text-2xl font-bold text-agent-ink">Contact &amp; Support</h2>
        <p className="text-sm text-agent-muted">Reach your Relationship Manager directly, or raise a support ticket.</p>
      </div>
      <ErrorText>{error}</ErrorText>
      {loading ? <p className="text-sm text-agent-muted">Loading…</p> : <RelationshipManagerCard rm={agency?.relationshipManager} />}

      <NewTicketForm onCreated={loadTickets} />

      <div>
        <h3 className="mb-3 text-lg font-bold text-agent-ink">Your Tickets</h3>
        {ticketsLoading ? (
          <p className="text-sm text-agent-muted">Loading…</p>
        ) : tickets.length === 0 ? (
          <p className="text-sm text-agent-muted">No tickets yet.</p>
        ) : (
          <div className="space-y-3">
            {tickets.map((t) => (
              <TicketCard
                key={t.id}
                ticket={t}
                expanded={expandedId === t.id}
                onToggle={() => setExpandedId((id) => (id === t.id ? null : t.id))}
                onReplied={loadTickets}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
