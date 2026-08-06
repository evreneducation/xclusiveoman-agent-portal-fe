// Reusable notification bell + dropdown panel (doc §12.10/§13, Screen 20).
// Deliberately portal-agnostic — no `agent-*`/admin `ink` design tokens, and
// no hardcoded routes — so the Admin Portal can mount this exact component
// later just by passing its own api client, socket accessor and route
// resolver, the same way agent/api/client.js and agent/lib/socket.js are
// each a thin per-portal instance of the shared factories in ../api and
// ../socket.
import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

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

function DefaultBellIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

/**
 * Props:
 * - api: portal's api client ({ get, patch, ... }) — see shared/api/createApiClient.js
 * - getSocket: () => current Socket.IO client | null — see shared/socket/createSocketClient.js
 * - socketConnected: boolean — re-subscribes once a connection lands (e.g. after login)
 * - resolvePath(referenceType, referenceId): string | null — maps a notification to an
 *   in-portal route; each portal owns this mapping (its routes are its own)
 * - onNavigate(path): called with resolvePath()'s result on row click
 * - icon: optional icon component (defaults to a plain bell glyph)
 * - buttonClassName / panelClassName: optional style hooks so each portal's header can
 *   match its own chrome without this component needing portal-specific tokens
 */
export function NotificationBell({
  api,
  getSocket,
  socketConnected,
  resolvePath,
  onNavigate,
  icon: Icon = DefaultBellIcon,
  buttonClassName = '',
  panelClassName = '',
}) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const containerRef = useRef(null);

  // Item 7 — load existing notifications + unread count on mount.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([api.get('/notifications'), api.get('/notifications/unread-count')])
      .then(([{ notifications: list }, { count }]) => {
        if (cancelled) return;
        setNotifications(list);
        setUnreadCount(count);
      })
      .catch((err) => !cancelled && setError(err.message || 'Unable to load notifications'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [api]);

  // Item 6 — live push: new notification joins the top of the list and the
  // badge updates immediately, no refresh. Re-subscribes on reconnect.
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return undefined;

    function handleNew(notification) {
      setNotifications((list) => [notification, ...list]);
      setUnreadCount((c) => c + 1);
    }

    socket.on('notification:new', handleNew);
    return () => socket.off('notification:new', handleNew);
  }, [getSocket, socketConnected]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return undefined;
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const markOneRead = useCallback(
    (id) => {
      setNotifications((list) => list.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
      setUnreadCount((c) => Math.max(0, c - 1));
      api.patch(`/notifications/${id}/read`).catch(() => {});
    },
    [api]
  );

  function handleMarkAllRead() {
    if (unreadCount === 0) return;
    setNotifications((list) => list.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    api.patch('/notifications/read-all').catch(() => {});
  }

  // Item 4 — click marks read (if needed) and deep-links via referenceType/referenceId.
  function handleRowClick(n) {
    if (!n.isRead) markOneRead(n.id);
    const path = resolvePath?.(n.referenceType, n.referenceId);
    if (path) onNavigate?.(path);
    setOpen(false);
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        aria-expanded={open}
        className={`relative flex items-center justify-center ${buttonClassName}`}
      >
        <Icon width={18} height={18} />
        {unreadCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full border-2 border-white bg-red-600 px-1 text-[9px] font-bold leading-none text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className={`absolute right-0 top-full z-50 mt-2 w-[22rem] max-w-[90vw] overflow-hidden rounded-xl border border-gray-200 bg-white text-left shadow-xl ${panelClassName}`}
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <span className="text-sm font-bold text-gray-900">Notifications</span>
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={unreadCount === 0}
                className="text-[11px] font-semibold text-gray-500 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Mark all as read
              </button>
            </div>

            <div className="max-h-[26rem] overflow-y-auto">
              {loading && <p className="px-4 py-6 text-center text-xs text-gray-400">Loading…</p>}
              {!loading && error && <p className="px-4 py-6 text-center text-xs text-red-500">{error}</p>}
              {!loading && !error && notifications.length === 0 && (
                <p className="px-4 py-8 text-center text-xs text-gray-400">You're all caught up.</p>
              )}
              {!loading &&
                !error &&
                notifications.map((n) => (
                  <div
                    key={n.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleRowClick(n)}
                    onKeyDown={(e) => e.key === 'Enter' && handleRowClick(n)}
                    className={`flex w-full cursor-pointer items-start gap-2.5 border-b border-gray-50 px-4 py-3 text-left last:border-0 hover:bg-gray-50 ${
                      !n.isRead ? 'bg-blue-50/50' : ''
                    }`}
                  >
                    <button
                      type="button"
                      title={n.isRead ? 'Read' : 'Mark as read'}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!n.isRead) markOneRead(n.id);
                      }}
                      className="mt-1.5 flex-none"
                    >
                      <span className={`block h-2 w-2 rounded-full ${!n.isRead ? 'bg-blue-500' : 'bg-transparent'}`} />
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className={`text-sm leading-snug ${!n.isRead ? 'font-bold text-gray-900' : 'font-semibold text-gray-700'}`}>
                        {n.title}
                      </div>
                      <div className="mt-0.5 line-clamp-2 text-xs leading-snug text-gray-500">{n.message}</div>
                      <div className="mt-1 text-[10px] text-gray-400">{timeAgo(n.createdAt)}</div>
                    </div>
                  </div>
                ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
