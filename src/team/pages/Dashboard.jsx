import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Card } from '../components/ui.jsx';

const LM_CARDS = [
  { feature: 'catalog', to: '/team/catalog', label: 'Catalog', description: 'Browse the live Product & MICE catalog.' },
  { feature: 'quotesPricing', to: '/team/quotes-pricing', label: 'Quotes & Pricing', description: 'FIT and MICE requests assigned to you.' },
  { feature: 'bookingsDocs', to: '/team/bookings-docs', label: 'Bookings & Docs', description: 'Fixed Group Departure bookings and traveler documents.' },
  { feature: 'fdOperations', to: '/team/fd-operations', label: 'FD Operation', description: 'Track upcoming departures through to dispatch.' },
];

const RM_CARDS = [
  { feature: 'approvedAgents', to: '/team/approved-agents', label: 'Approved Agents', description: 'Agencies assigned to you as their Relationship Manager.' },
  { feature: 'quotesPricing', to: '/team/quotes-pricing', label: 'Quotes & Pricing', description: "Your agencies' FIT and MICE requests, view-only." },
  { feature: 'supportTickets', to: '/team/support-tickets', label: 'Support Tickets', description: "Helpdesk tickets raised by your agencies." },
  { feature: 'bookingsDocs', to: '/team/bookings-docs', label: 'Bookings & Docs', description: "Your agencies' bookings and traveler documents." },
];

export default function Dashboard() {
  const { user, isLeadManager, hasFeature } = useAuth();
  const cards = (isLeadManager ? LM_CARDS : RM_CARDS).filter((c) => hasFeature(c.feature));

  return (
    <div className="mx-auto max-w-5xl p-6 lg:p-10">
      <div className="mb-8">
        <h2
          style={{
            backgroundImage: 'linear-gradient(90deg, #1E2532, #BE123C, #E11D48)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
          }}
          className="text-3xl font-bold"
        >
          Welcome, {user?.fullName}
        </h2>
        <p className="mt-1 text-sm text-team-muted">
          {isLeadManager ? 'Lead Manager' : 'Relationship Manager'} — here's what's enabled on your account.
        </p>
      </div>

      {cards.length === 0 ? (
        <Card>
          <p className="text-sm text-team-muted">
            No Access Features are enabled on your account yet. Contact an admin to request access.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {cards.map((c) => (
            <Link key={c.to} to={c.to}>
              <Card className="!border-t-4 !border-t-team-accent transition hover:-translate-y-0.5 hover:shadow-lg">
                <div className="text-base font-bold text-team-ink">{c.label}</div>
                <p className="mt-1.5 text-xs text-team-muted">{c.description}</p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
