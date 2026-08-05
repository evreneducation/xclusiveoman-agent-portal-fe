import ComingSoon from '../components/ComingSoon.jsx';

// No notifications API/routes exist on the backend yet (doc §12.10
// GET /notifications, PATCH /notifications/:id/read aren't implemented in
// this build), so this stays a placeholder rather than fabricating a feed.
export default function Notifications() {
  return (
    <div className="mx-auto max-w-3xl p-5 lg:p-8">
      <h2 className="mb-1 text-2xl font-bold text-agent-ink">Notification Center</h2>
      <p className="mb-5 text-sm text-agent-muted">
        Real-time updates on your quotes, bookings, payments, and departures will land here.
      </p>
      <ComingSoon />
    </div>
  );
}
