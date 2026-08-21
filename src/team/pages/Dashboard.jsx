import { Link } from 'react-router-dom';
import { LuLayoutGrid, LuInbox, LuClipboardCheck, LuTruck, LuUserCheck, LuHeadset, LuSparkles } from 'react-icons/lu';
import { useAuth } from '../context/AuthContext.jsx';
import { Card, EmptyState } from '../components/ui.jsx';

// Same icon set TeamLayout.jsx's own sidebar nav uses per feature, so a
// dashboard shortcut and its sidebar entry always read as the same
// destination, not two different visual identities for one place.
const LM_CARDS = [
  { feature: 'catalog', to: '/team/catalog', label: 'Catalog', description: 'Browse the live Product & MICE catalog.', Icon: LuLayoutGrid },
  { feature: 'quotesPricing', to: '/team/quotes-pricing', label: 'Quotes & Pricing', description: 'FIT and MICE requests assigned to you.', Icon: LuInbox },
  { feature: 'bookingsDocs', to: '/team/bookings-docs', label: 'Bookings & Docs', description: 'Fixed Group Departure bookings and traveler documents.', Icon: LuClipboardCheck },
  { feature: 'fdOperations', to: '/team/fd-operations', label: 'FD Operation', description: 'Track upcoming departures through to dispatch.', Icon: LuTruck },
];

const RM_CARDS = [
  { feature: 'approvedAgents', to: '/team/approved-agents', label: 'Approved Agents', description: 'Agencies assigned to you as their Relationship Manager.', Icon: LuUserCheck },
  { feature: 'quotesPricing', to: '/team/quotes-pricing', label: 'Quotes & Pricing', description: "Your agencies' FIT and MICE requests, view-only.", Icon: LuInbox },
  { feature: 'supportTickets', to: '/team/support-tickets', label: 'Support Tickets', description: 'Helpdesk tickets raised by your agencies.', Icon: LuHeadset },
  { feature: 'bookingsDocs', to: '/team/bookings-docs', label: 'Bookings & Docs', description: "Your agencies' bookings and traveler documents.", Icon: LuClipboardCheck },
];

const ROLE_LABEL = { sales_manager: 'Lead Manager', relationship_manager: 'Relationship Manager' };

export default function Dashboard() {
  const { user, isLeadManager, hasFeature } = useAuth();
  const cards = (isLeadManager ? LM_CARDS : RM_CARDS).filter((c) => hasFeature(c.feature));

  return (
    <div className="mx-auto max-w-5xl p-6 lg:p-10">
      {/* Banded header — same ink/accent gradient the sidebar's own
          background uses, so the dashboard reads as this portal's front
          door rather than a plain content page. */}
      <div
        style={{ background: 'linear-gradient(120deg, #1E2532 0%, #3F1424 100%)' }}
        className="mb-8 overflow-hidden rounded-2xl px-6 py-7 shadow-lg shadow-black/10 sm:px-8"
      >
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-white/50">
          <LuSparkles size={14} />
          Team Portal
        </div>
        <h2 className="mt-2 text-2xl font-bold text-white sm:text-3xl">Welcome, {user?.fullName}</h2>
        <p className="mt-1.5 text-sm text-white/70">
          Signed in as <span className="font-semibold text-white/90">{ROLE_LABEL[user?.role] || user?.role}</span> —
          here's what's enabled on your account.
        </p>
      </div>

      {cards.length === 0 ? (
        <EmptyState icon={LuSparkles}>
          No Access Features are enabled on your account yet. Contact an admin to request access.
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {cards.map(({ to, label, description, Icon }) => (
            <Link key={to} to={to}>
              <Card className="!border-t-4 !border-t-team-accent transition hover:-translate-y-0.5 hover:shadow-lg">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-team-accent-soft text-team-accent-dark">
                    <Icon size={18} />
                  </span>
                  <div className="min-w-0">
                    <div className="text-base font-bold text-team-ink">{label}</div>
                    <p className="mt-1 text-xs text-team-muted">{description}</p>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
