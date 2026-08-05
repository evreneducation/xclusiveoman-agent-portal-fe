import ComingSoon from '../components/ComingSoon.jsx';

// PRD screens 22 (Manual Booking Flow) and 23 (Client Documents & Visa
// Processing) — no /admin/bookings/manual or documents routes exist in this
// backend build yet, so this stays a placeholder rather than fabricating data.
export default function BookingsDocuments() {
  return (
    <ComingSoon
      title="Bookings & Documents"
      description="Manual booking creation and traveler document / visa processing will live here."
    />
  );
}
