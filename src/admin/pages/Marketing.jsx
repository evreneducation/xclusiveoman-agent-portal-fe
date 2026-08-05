import ComingSoon from '../components/ComingSoon.jsx';

// PRD screen 17 (Marketing Center) — no /admin/marketing/campaigns routes
// exist in this backend build yet.
export default function Marketing() {
  return (
    <ComingSoon
      title="Marketing"
      description="Compose and send email/WhatsApp campaigns to agencies, and review campaign history."
    />
  );
}
