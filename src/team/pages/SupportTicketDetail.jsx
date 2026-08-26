import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { Badge, Button, Card, ErrorText, Textarea } from '../components/ui.jsx';
import { RichTextDisplay } from '../../shared/components/RichTextEditor.jsx';

export default function SupportTicketDetail() {
  const { id } = useParams();
  const [ticket, setTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState('');
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  function load() {
    api
      .get(`/admin/support/tickets/${id}`)
      .then((data) => {
        setTicket(data.ticket);
        setMessages(data.messages || []);
      })
      .catch((err) => setError(err.message || 'Unable to load ticket'));
  }

  useEffect(load, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function sendReply(e) {
    e.preventDefault();
    if (!reply.trim()) return;
    setSending(true);
    setError('');
    try {
      await api.post(`/admin/support/tickets/${id}/messages`, { message: reply });
      setReply('');
      load();
    } catch (err) {
      setError(err.message || 'Unable to send reply');
    } finally {
      setSending(false);
    }
  }

  if (!ticket) return <p className="p-10 text-xs text-team-muted">{error || 'Loading…'}</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-6 lg:p-10">
      <Link to="/team/support-tickets" className="text-xs font-semibold text-team-accent-dark hover:underline">
        ← Back to Support Tickets
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-team-ink">{ticket.subject}</h2>
          <p className="mt-1 text-sm text-team-muted">{ticket.agencyName} · {ticket.createdByName}</p>
        </div>
        <Badge tone={ticket.status === 'resolved' || ticket.status === 'closed' ? 'green' : 'amber'}>{ticket.status?.replace(/_/g, ' ')}</Badge>
      </div>

      <Card label="Description">
        <RichTextDisplay html={ticket.description} className="text-sm text-team-ink" />
      </Card>

      <Card label="Conversation">
        <div className="space-y-3">
          {messages.map((m) => (
            <div key={m.id} className="rounded-lg border border-team-line-light bg-team-panel p-3">
              <div className="flex items-center justify-between text-[11px] text-team-muted">
                <span className="font-semibold text-team-ink">{m.senderName}</span>
                <span>{new Date(m.createdAt).toLocaleString()}</span>
              </div>
              <p className="mt-1.5 whitespace-pre-wrap text-sm text-team-ink">{m.message}</p>
            </div>
          ))}
          {messages.length === 0 && <p className="text-xs text-team-muted">No replies yet.</p>}
        </div>

        <ErrorText>{error}</ErrorText>

        <form onSubmit={sendReply} className="mt-4 space-y-2">
          <Textarea rows={3} placeholder="Write a reply…" value={reply} onChange={(e) => setReply(e.target.value)} />
          <Button variant="accent" type="submit" disabled={sending || !reply.trim()}>
            {sending ? 'Sending…' : 'Send Reply'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
