import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api/client.js';
import { getSocket } from '../lib/socket.js';
import { resolveNotificationPath } from '../lib/notificationRoutes.js';
import { Button, Card, ErrorText, Tag } from '../components/ui.jsx';

function timeAgo(isoString) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(isoString).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(isoString).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
];

// Full "Notification Center" page — the header bell (NotificationBell.jsx,
// mounted in AgentLayout.jsx) only ever shows a short recent slice in a
// dropdown; this is the same GET /notifications feed and mark-as-read
// actions, just as its own persistent page with an All/Unread filter and no
// panel-height cap. resolveNotificationPath is shared with the bell (see
// lib/notificationRoutes.js) so a notification deep-links the same way
// whichever surface it was clicked from.
export default function Notifications() {
  const navigate = useNavigate();
  const { socketConnected } = useAuth();
  const [filter, setFilter] = useState('all');
  const [notifications, setNotifications] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    api
      .get(`/notifications${filter === 'unread' ? '?unread=true' : ''}`)
      .then(({ notifications: list }) => !cancelled && setNotifications(list))
      .catch((err) => !cancelled && setError(err.message || 'Unable to load notifications'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [filter]);

  // Live push — a new notification joins the top of the list immediately,
  // same as the header bell. Only relevant while viewing "All"; under
  // "Unread" it still belongs (a brand-new notification is unread), so no
  // filter check is needed either way.
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return undefined;
    function handleNew(notification) {
      setNotifications((list) => (list ? [notification, ...list] : list));
    }
    socket.on('notification:new', handleNew);
    return () => socket.off('notification:new', handleNew);
  }, [socketConnected]);

  const unreadCount = (notifications || []).filter((n) => !n.isRead).length;

  function markOneRead(id) {
    setNotifications((list) => list.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    api.patch(`/notifications/${id}/read`).catch(() => {});
  }

  function handleMarkAllRead() {
    if (unreadCount === 0) return;
    setNotifications((list) => list.map((n) => ({ ...n, isRead: true })));
    api.patch('/notifications/read-all').catch(() => {});
  }

  function handleRowClick(n) {
    if (!n.isRead) markOneRead(n.id);
    const path = resolveNotificationPath(n.referenceType, n.referenceId);
    if (path) navigate(path);
  }

  return (
    <div className="mx-auto max-w-3xl p-5 lg:p-8">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-agent-ink">Notification Center</h2>
        <Button onClick={handleMarkAllRead} disabled={unreadCount === 0}>
          Mark all as read
        </Button>
      </div>
      <p className="mb-5 text-sm text-agent-muted">Real-time updates on your quotes, bookings, payments, and departures.</p>

      <div className="mb-4 flex gap-2">
        {FILTERS.map((f) => (
          <button key={f.key} type="button" onClick={() => setFilter(f.key)}>
            <Tag active={filter === f.key}>
              {f.label}
              {f.key === 'unread' && unreadCount > 0 ? ` (${unreadCount})` : ''}
            </Tag>
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-agent-muted">Loading…</p>}
      <ErrorText>{error}</ErrorText>

      {!loading && !error && notifications?.length === 0 && (
        <Card className="border-white text-center">
          <p className="text-sm text-agent-muted">
            {filter === 'unread' ? "You're all caught up." : 'No notifications yet.'}
          </p>
        </Card>
      )}

      {!loading && notifications?.length > 0 && (
        <div className="space-y-2">
          {notifications.map((n) => {
            return (
              <div
                key={n.id}
                role="button"
                tabIndex={0}
                onClick={() => handleRowClick(n)}
                onKeyDown={(e) => e.key === 'Enter' && handleRowClick(n)}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 shadow-sm transition hover:border-agent-accent ${
                  !n.isRead ? 'border-agent-accent/40 bg-agent-accent-soft/40' : 'border-agent-line-light bg-white'
                }`}
              >
                <span className={`mt-1.5 h-2 w-2 flex-none rounded-full ${!n.isRead ? 'bg-agent-accent-dark' : 'bg-transparent'}`} />
                <div className="min-w-0 flex-1">
                  <div className={`text-sm leading-snug ${!n.isRead ? 'font-bold text-agent-ink' : 'font-semibold text-agent-ink'}`}>
                    {n.title}
                  </div>
                  <div className="mt-0.5 text-xs leading-snug text-agent-muted">{n.message}</div>
                  <div className="mt-1.5 text-[10px] text-agent-muted">{timeAgo(n.createdAt)}</div>
                </div>
                {!n.isRead && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      markOneRead(n.id);
                    }}
                    className="flex-none text-[11px] font-semibold text-agent-accent-dark hover:underline"
                  >
                    Mark read
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
