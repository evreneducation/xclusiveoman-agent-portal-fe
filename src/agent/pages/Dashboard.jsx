import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { Link } from 'react-router-dom';
import { LuMail, LuPhone } from 'react-icons/lu';
import { FaCircleCheck } from 'react-icons/fa6';
import { api } from '../api/client.js';
import { Button, Card } from '../components/ui.jsx';
import { formatCurrency } from '../../shared/fdPackage/index.js';

// A request is "open" once it's left Draft and hasn't reached a terminal
// outcome yet; "awaiting pricing" narrows that to before the admin has
// costed/published it. Both FIT (packageRequests.controller.js) and MICE
// (miceRfqs.controller.js) already compute an agent-facing `statusLabel`
// with these exact values, so no raw DB status/enum needs to leak in here.
const TERMINAL_LABELS = new Set(['Accepted', 'Declined', 'Expired']);
const AWAITING_PRICING_LABELS = new Set(['Submitted', 'Under Review']);

// "Confirmed" bookings — anything actually locked in, as opposed to still
// waiting on payment or cancelled/waitlisted (bookings.controller.js status
// enum: pending_payment/deposit_paid/confirmed/balance_due/fully_paid/
// amendment_requested/cancellation_requested/cancelled/completed/waitlisted).
const CONFIRMED_BOOKING_STATUSES = new Set([
  'deposit_paid', 'confirmed', 'balance_due', 'fully_paid', 'amendment_requested', 'completed',
]);

// "Deals For You" — falls back to this single static slide (real photo,
// hardcoded copy) whenever the admin-curated Deals list (AdminLayout.jsx's
// own "Deals" tab, GET /deals) is empty or still loading, so the section
// never renders looking broken/blank before the admin has uploaded anything.
const PLACEHOLDER_DEAL = {
  title: 'Magical Muscat',
  duration: '4N | 5D',
  imageUrl: 'https://images.unsplash.com/photo-1763377220339-de687c3efad4?auto=format&fit=crop&w=1600&q=80',
};

// How long each slide holds before auto-advancing to the next deal.
const DEAL_ROTATE_MS = 5000;

function RelationshipManagerCard({ rm }) {
  if (!rm) {
    return (
      <div className="rounded-2xl border border-agent-line-light bg-white p-6 shadow-sm">
        <span className="inline-flex rounded-full border border-agent-line-light bg-agent-panel px-3 py-1 text-xs font-semibold text-agent-ink">
          Your Relationship Manager
        </span>
        <p className="mt-4 text-sm text-agent-muted">
          No Relationship Manager assigned yet. One will be assigned by Xclusive Oman shortly.
        </p>
      </div>
    );
  }

  const initials = rm.fullName
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="rounded-2xl border border-agent-line-light bg-white p-6 shadow-sm">
      <span className="inline-flex rounded-full border border-agent-line-light bg-agent-panel px-3 py-1 text-xs font-semibold text-agent-ink">
        Your Relationship Manager
      </span>

      <div className="mt-4 flex items-center gap-4">
        <div className="flex h-14 w-14 flex-none items-center justify-center rounded-full bg-agent-accent text-lg font-bold text-agent-ink-dark shadow-sm">
          {initials}
        </div>
        <div className="min-w-0">
          <div className="truncate text-2xl font-extrabold text-agent-ink">{rm.fullName}</div>
          <div className="text-sm text-agent-muted">Xclusive Oman</div>
        </div>
      </div>

      <div className="my-4 h-px bg-agent-line" />

      {/* Grid, not flex+justify-between — three independent columns (email
          start, phone centered, WhatsApp end) so the phone number lands in
          the true middle of the row regardless of how wide the email or the
          WhatsApp pill happen to be, rather than just wherever leftover
          flex space pushes it. */}
      <div className="grid grid-cols-3 items-center gap-3 text-sm text-agent-ink">
        <span className="flex items-center justify-self-start gap-2">
          <LuMail size={15} className="flex-none text-agent-accent-dark" />
          {rm.email}
        </span>
        {rm.phone && (
          <span className="flex items-center justify-self-center gap-2">
            <LuPhone size={15} className="flex-none text-agent-accent-dark" />
            {rm.phone}
          </span>
        )}
        {rm.whatsappNumber && (
          <a
            href={`https://wa.me/${rm.whatsappNumber.replace(/[^\d]/g, '')}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex flex-none items-center justify-self-end gap-1.5 rounded-full border border-[#2f7d32] bg-[#eef7ee] px-3 py-1.5 text-xs font-semibold text-[#2f7d32]"
          >
            💬 Chat on WhatsApp
          </a>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [agency, setAgency] = useState(null);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  // null while loading — kept separate from `deals`'s eventual empty-array
  // state so the slide below can fall back to PLACEHOLDER_DEAL in both
  // cases without telling them apart.
  const [deals, setDeals] = useState(null);
  const [activeDeal, setActiveDeal] = useState(0);

  useEffect(() => {
    api
      .get('/deals')
      .then(({ deals: d }) => setDeals(d))
      .catch(() => setDeals([]));
  }, []);

  // Only rotates once there are at least two real deals to cycle between —
  // a single deal (or the placeholder fallback) just sits still.
  useEffect(() => {
    if (!deals || deals.length < 2) return;
    const id = setInterval(() => setActiveDeal((i) => (i + 1) % deals.length), DEAL_ROTATE_MS);
    return () => clearInterval(id);
  }, [deals]);

  const dealSlides = deals && deals.length > 0 ? deals : [PLACEHOLDER_DEAL];
  const currentDeal = dealSlides[activeDeal % dealSlides.length];
  const currentDealImage = currentDeal.imageUrl ?? currentDeal.image_url;

  useEffect(() => {
    Promise.all([
      api.get('/agencies/me'),
      api.get('/package-requests'),
      api.get('/mice/rfqs'),
      api.get('/bookings'),
    ])
      .then(([{ agency: a }, { packageRequests }, { miceRfqs }, { bookings }]) => {
        setAgency(a);

        const openQuotes = [...packageRequests, ...miceRfqs].filter(
          (r) => r.statusLabel !== 'Draft' && !TERMINAL_LABELS.has(r.statusLabel)
        ).length;
        const awaitingPricing = [...packageRequests, ...miceRfqs].filter((r) =>
          AWAITING_PRICING_LABELS.has(r.statusLabel)
        ).length;
        const confirmedBookings = bookings.filter((b) => CONFIRMED_BOOKING_STATUSES.has(b.status)).length;
        const balanceDue = bookings.reduce((sum, b) => sum + Number(b.balanceDue || 0), 0);

        setStats({ openQuotes, awaitingPricing, confirmedBookings, balanceDue });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const STAT_CARDS = stats
    ? [
        { label: 'Open Quotes', value: stats.openQuotes, hint: 'FIT + MICE, in progress' },
        { label: 'Awaiting Pricing', value: stats.awaitingPricing, hint: 'Submitted, Not Yet priced' },
        { label: 'Confirmed Bookings', value: stats.confirmedBookings, hint: 'Across All Sources' },
        { label: 'Balance Due', value: formatCurrency(stats.balanceDue), hint: 'Outstanding Across Bookings' },
      ]
    : [];

  return (
    // No mx-auto/max-w cap — the page fills the full width available next to
    // the sidebar (matching the reference design), with only a small edge
    // gap from the padding itself rather than a centered, narrower column.
    <div className="p-4 lg:p-6">
      {error && <p className="mb-5 rounded-lg border border-[#f2bdc6] bg-[#fff7f8] px-4 py-3 text-sm text-[#a5162d]">{error}</p>}

      <div className="mb-6 flex flex-wrap gap-3">
        <Link to="/agent/departures">
          <Button variant="accent" className="!rounded-full px-5 py-2.5 text-sm">
            Browse Group Departures
          </Button>
        </Link>
        <Link to="/agent/package-builder">
          <Button className="!rounded-full px-5 py-2.5 text-sm">Build a Custom FIT Package</Button>
        </Link>
        <Link to="/agent/transactions">
          <Button className="!rounded-full px-5 py-2.5 text-sm">Payment &amp; Transaction History</Button>
        </Link>
      </div>

      {/* Uneven split (2fr/3fr, not a plain 50/50) — the agency card has far
          less to show than the Relationship Manager card (name + one line
          vs. avatar/name/contact row), so matching the reference design's
          narrower left column avoids a lot of dead white space there. */}
      <div className="mb-8 grid grid-cols-1 gap-5 lg:grid-cols-[2fr_3fr]">
        <div className="rounded-2xl border border-agent-line-light bg-white p-6 shadow-sm">
          <h2 className="text-3xl font-extrabold leading-tight text-agent-ink">{agency?.name || 'Your agency'}</h2>
          <div className="my-4 h-px bg-agent-line" />
          <p className="text-sm text-agent-muted">
            Signed in as {user?.fullName}
            <br />({user?.email})
          </p>
        </div>

        <RelationshipManagerCard rm={agency?.relationshipManager} />
      </div>

      <h2 className="mb-4 text-3xl font-extrabold text-agent-ink">Deals For You</h2>
      {/* Admin-curated deals (AdminLayout.jsx's own "Deals" tab, GET /deals),
          auto-rotating every DEAL_ROTATE_MS when there's more than one —
          falls back to the single static PLACEHOLDER_DEAL slide (dots still
          rendered, just non-interactive with only one slide) whenever the
          admin hasn't uploaded any yet. */}
      <div className="relative mb-8 h-56 overflow-hidden rounded-2xl bg-[#0B1130] shadow-sm sm:h-72 lg:h-80">
        <img
          src={currentDealImage}
          alt={currentDeal.title}
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/40" />
        {currentDeal.duration && (
          <div className="absolute inset-x-0 top-4 text-center text-xs font-semibold uppercase tracking-widest text-white/90">
            {currentDeal.duration}
          </div>
        )}
        <div className="absolute inset-x-0 bottom-10 px-6 text-center">
          <h3 className="text-3xl font-extrabold text-white sm:text-4xl lg:text-5xl">{currentDeal.title}</h3>
        </div>
        {dealSlides.length > 1 && (
          <div className="absolute inset-x-0 bottom-4 flex justify-center gap-1.5">
            {dealSlides.map((slide, i) => (
              <button
                key={slide.id || i}
                type="button"
                onClick={() => setActiveDeal(i)}
                aria-label={`Show slide ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${i === activeDeal ? 'w-4 bg-white' : 'w-1.5 bg-white/50'}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Custom header instead of Card's own `label` prop (small uppercase
          gold text, no rule) — these four need a larger, dark, natural-case
          heading with a full-width underline (not sized to the text) below
          it. Tighter mb/pb than a default Card heading would use, so the
          bigger text + rule don't grow the card past its existing min-h-28.
          Scoped here rather than changed on Card itself, which plenty of
          other cards across both portals still rely on for its existing
          look. */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading
          ? ['Open Quotes', 'Awaiting Pricing', 'Confirmed Bookings', 'Balance Due'].map((label) => (
              <Card key={label} className="min-h-28 border-white">
                <div className="mb-2.5 border-b border-agent-line pb-1.5 text-base font-bold text-agent-ink">{label}</div>
                <div className="text-2xl font-bold text-agent-muted">—</div>
                <div className="mt-1.5 text-sm text-agent-muted">Loading…</div>
              </Card>
            ))
          : STAT_CARDS.map(({ label, value, hint }) => (
              <Card key={label} className="min-h-28 border-white">
                <div className="mb-2.5 border-b border-agent-line pb-1.5 text-base font-bold text-agent-ink">{label}</div>
                <div className="text-2xl font-bold text-agent-ink">{value}</div>
                <div className="mt-1.5 text-sm text-agent-muted">{hint}</div>
              </Card>
            ))}
      </div>

      <div className="flex items-center justify-between rounded-full border border-agent-line-light bg-white px-6 py-4 shadow-sm">
        <span className="text-base font-bold text-agent-ink">Account Status</span>
        <span className="flex items-center gap-2 text-base font-bold text-agent-ink">
          <FaCircleCheck className="flex-none text-green-500" size={20} />
          {agency?.status === 'approved' ? 'Approved' : agency?.status || 'Unknown'}
        </span>
      </div>
      {agency?.status !== 'approved' && (
        <p className="mt-2 text-sm text-agent-muted">
          Your agency is still pending approval — quotes, bookings and departures unlock once a Super Admin approves
          your account.
        </p>
      )}
    </div>
  );
}
