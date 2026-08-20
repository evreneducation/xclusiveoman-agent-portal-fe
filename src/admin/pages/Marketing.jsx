import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../../shared/components/ToastProvider.jsx';
import { Badge, Button, Card, Checkbox, ErrorText, FieldLabel, Select, Table, Tag, Textarea, TextInput } from '../components/ui.jsx';

// PRD screen 17 (Marketing Center). Task 5 makes Send Test and Send
// Campaign real (POST /admin/marketing/send-test, POST
// /admin/marketing/campaigns — backend added this task). Task 6 adds
// Schedule Campaign + Cancel Schedule. Task 7 makes Campaign History real
// (GET /admin/marketing/campaigns[, /:id, /:id/recipients] — backend added
// this task, reusing the same marketing_campaigns/marketing_campaign_recipients
// tables Task 5 created). Task 8 adds Admin Activity + in-app Notifications
// for campaign lifecycle events (backend only — no frontend change needed,
// the existing NotificationBell renders any notification type generically).
// Task 9 makes Channel Settings real (GET /admin/marketing/channels, POST
// /admin/marketing/channels/:provider/test-connection) and wires Compose's
// own Channel status display to the same backend-verified data. Task 10
// makes Audience Segments real — a browse/preview surface over the exact
// same four segments Compose's AudienceSection and the backend's
// resolveAudience() already define, via GET /admin/agencies (extended to
// forward tier/country, which listAgencies() already accepted).
const TABS = [
  { key: 'compose', label: 'Compose' },
  { key: 'history', label: 'Campaign History' },
  { key: 'segments', label: 'Audience Segments' },
  { key: 'channels', label: 'Channel Settings' },
];

// Static UI enums, not campaign data — same category as TABS above.
const CHANNEL_OPTIONS = [
  { value: 'email', label: 'Email' },
  { value: 'whatsapp', label: 'WhatsApp' },
];

// Provider list per channel — Email offers a choice, WhatsApp has exactly
// one option today (still a Select, for the same reason and same UI as
// Email, rather than a special-cased single line). Only 'built_in' actually
// sends anything — see SendTestModal/handleConfirmSend below and the
// backend's marketing.controller.js — the other three have no integration
// built yet and the backend returns a clear "not configured" error rather
// than faking a send.
const PROVIDER_OPTIONS = {
  email: [
    { value: 'mailchimp', label: 'Mailchimp' },
    { value: 'zoho', label: 'Zoho Campaigns' },
    { value: 'built_in', label: 'Built-in sender' },
  ],
  whatsapp: [{ value: 'whatsapp_business_api', label: 'WhatsApp Business API' }],
};

const PROVIDER_LABELS = {
  mailchimp: 'Mailchimp',
  zoho: 'Zoho Campaigns',
  built_in: 'Built-in sender',
  whatsapp_business_api: 'WhatsApp Business API',
};

// Real, backend-verified statuses (Task 9 — GET /admin/marketing/channels /
// POST /admin/marketing/channels/:provider/test-connection), replacing the
// old hard-coded "every provider is configuration required" default.
// 'not_implemented' is deliberately distinct from 'configuration_required':
// the former means no integration/credential surface exists at all for that
// provider (Mailchimp, Zoho Campaigns, WhatsApp Business API — confirmed by
// backend inspection), never shown as something an admin could "Configure"
// here; the latter (built_in only, when Brevo env vars are unset) is a real,
// fixable gap. 'connected' is only ever returned once the backend has
// actually verified the provider (a live Brevo API auth check for built_in) —
// never merely because credentials exist.
const PROVIDER_STATUS_META = {
  connected: { label: 'Connected', tone: 'green' },
  configuration_required: { label: 'Configuration required', tone: 'amber' },
  connection_failed: { label: 'Connection failed', tone: 'red' },
  not_implemented: { label: 'Not implemented', tone: 'grey' },
};

// Static UI enum — the audience *segment kinds*, not the agency data itself.
const AUDIENCE_OPTIONS = [
  { value: 'all', label: 'All Agents' },
  { value: 'tier', label: 'By Tier' },
  { value: 'country', label: 'By Country' },
  { value: 'inactive_30d', label: 'Inactive 30+ days' },
];

// Same tier values as the `agency_tier` Postgres enum (agencies.model.js /
// migrations/0002_agencies.sql) — mirrors the local `TIERS` constant
// AgentApprovals.jsx already uses for its own tier picker.
const TIERS = ['gold', 'silver', 'bronze'];

// How many days of no activity counts as "inactive" for that segment —
// matches the segment's own "30+ days" label and the backend's own
// definition (agencies.model.js's listAgencies / marketingCampaigns.model.js's
// resolveAudience — the server always recomputes this independently, this
// constant only drives the live count shown here).
const INACTIVE_SINCE_DAYS = 30;

// A "reasonable" email subject cap — most inbox previews truncate well
// before this, but it stops anything absurd rather than policing the
// recommended length via a hard limit.
const EMAIL_SUBJECT_MAX_LENGTH = 150;

// Simple client-side sanity check for the Send Test modal — the backend's
// zod `z.string().email()` (validation/schemas.js) is the real gate.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Schedule Campaign (Task 6) — the admin's own browser zone, editable, never
// silently assumed to be what they actually mean (requirement: don't assume
// server timezone == user timezone; same logic applies to just guessing the
// browser's zone without letting them change it).
const DEFAULT_TIMEZONE = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
})();

// `Intl.supportedValuesOf` is the standard, dependency-free way to list
// every IANA zone name — falls back to just the browser's own zone + UTC on
// the rare runtime without it, so the picker is never empty.
const TIMEZONE_OPTIONS = (() => {
  try {
    if (typeof Intl.supportedValuesOf === 'function') {
      const zones = Intl.supportedValuesOf('timeZone');
      if (zones.length > 0) return zones;
    }
  } catch {
    // fall through to the minimal fallback below
  }
  return Array.from(new Set([DEFAULT_TIMEZONE, 'UTC']));
})();

// Today, browser-local — matches the FIT builder's own todayDateString()
// convention (agent/pages/PackageBuilder.jsx) for the same reason: usable
// directly as an <input type="date"> `min` without any UTC-vs-local
// off-by-one surprises.
function todayLocalDateString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Advisory-only "not in the past" check, compared against the *browser's*
// own local clock (not necessarily the admin's selected Timezone — doing
// that properly needs the same zone-conversion math the backend already
// does authoritatively in utils/timezone.js). This just gates the button
// with a reasonable UX nicety; the real enforcement is server-side
// (validation/schemas.js's scheduleMarketingCampaignSchema).
function isFutureLocal(dateStr, timeStr) {
  if (!dateStr || !timeStr) return false;
  const candidate = new Date(`${dateStr}T${timeStr}:00`);
  return !Number.isNaN(candidate.getTime()) && candidate.getTime() > Date.now();
}

// Formats the admin's own entered date/time back for display (confirmation
// modal, success toast, the post-schedule banner) — no client-side zone
// math needed here, only the backend converts to a real UTC instant for
// storage/scheduling (utils/timezone.js). The timezone name is appended
// alongside so it's never ambiguous which zone those numbers refer to.
function formatScheduledLabel(dateStr, timeStr, timeZone) {
  if (!dateStr || !timeStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = timeStr.split(':').map(Number);
  const asLocal = new Date(year, month - 1, day, hour, minute);
  const formatted = asLocal.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${formatted} (${timeZone})`;
}

// Same "coming soon" card look as components/ComingSoon.jsx, sized for a
// tab body rather than a whole page (Marketing already has its own
// title/description above the tab nav).
function EmptyTabState({ description }) {
  return (
    <Card className="border-white text-center">
      <div className="py-14">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent">
          ✦
        </div>
        <p className="text-sm font-semibold text-ink">Coming soon</p>
        <p className="mx-auto mt-1 max-w-sm text-xs text-muted">{description}</p>
      </div>
    </Card>
  );
}

// No generic modal exists anywhere in the admin console yet — this is a
// small local one (overlay + centered Card-styled panel, same tokens as
// everywhere else) reused for both Send Test and the Send Campaign
// confirmation below rather than building two bespoke dialogs.
// `size` defaults to the original fixed max-w-md ('md') so every existing
// caller (SendTestModal, SendCampaignConfirmModal below) renders pixel-
// identical to before Task 7 — 'lg'/'xl' are opt-in, for Campaign
// History's Details/Recipients modals below, which need more room for a
// message body / a recipients table. max-h + overflow-y-auto is likewise
// harmless for the small existing modals (their content never gets close to
// filling 85% of viewport height) and is what lets a long recipients table
// scroll within the modal instead of the modal overflowing the page.
function Modal({ title, onClose, children, footer, size = 'md' }) {
  const sizeClass = size === 'xl' ? 'max-w-4xl' : size === 'lg' ? 'max-w-2xl' : 'max-w-md';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />
      <div className={`relative z-10 flex max-h-[85vh] w-full ${sizeClass} flex-col rounded-lg border border-line-light bg-white p-5 shadow-lg sm:p-6`}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <h3 className="text-lg font-bold text-ink">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="text-lg leading-none text-muted hover:text-ink">
            ×
          </button>
        </div>
        <div className="overflow-y-auto">{children}</div>
        {footer && <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-line-light pt-4">{footer}</div>}
      </div>
    </div>
  );
}

// --- Campaign History (Task 7) ---
//
// Every status the schema actually supports (0032/0033_marketing_campaign*.sql
// — draft/sending/sent/partially_failed/failed/scheduled/cancelled) — the
// same vocabulary the backend's own query-param filter validates against
// (marketingCampaigns.model.js's listCampaignsForAdmin), not a separately
// invented set. No 'draft' campaigns exist yet (ComposeTab's "Save Draft" is
// still disabled — "Not available yet"), but the filter/badge both support
// it already so nothing here needs revisiting once that ships.
const CAMPAIGN_STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'sending', label: 'Sending' },
  { value: 'sent', label: 'Sent' },
  { value: 'partially_failed', label: 'Partially Failed' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const CAMPAIGN_STATUS_TONE = {
  draft: 'grey',
  scheduled: 'amber',
  sending: 'amber',
  sent: 'green',
  partially_failed: 'amber',
  failed: 'red',
  cancelled: 'grey',
};

const RECIPIENT_STATUS_TONE = { pending: 'grey', sent: 'green', failed: 'red' };

function formatEnumLabel(value) {
  if (!value) return '—';
  return value
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// Same four segments AudienceSection/ComposeTab's own `audienceLabel` render
// (below) — a standalone version here since History displays an arbitrary
// *stored* audienceType/audienceValue pair read back from the database,
// rather than the in-progress selection ComposeTab tracks in its own state.
function formatAudienceLabel(audienceType, audienceValue) {
  if (audienceType === 'tier') return `By Tier — ${formatEnumLabel(audienceValue)}`;
  if (audienceType === 'country') return `By Country — ${audienceValue || '—'}`;
  if (audienceType === 'inactive_30d') return `Inactive ${INACTIVE_SINCE_DAYS}+ days`;
  return 'All Agents';
}

// Same "day month year, time" shape formatScheduledLabel (above) already
// uses for the admin's own scheduled-time input, minus the timezone suffix
// (these are real stored TIMESTAMPTZ values rendered in the browser's own
// zone, the same convention QuoteInbox.jsx's toLocaleDateString calls use —
// just with time added, since Created/Scheduled/Sent need it here).
function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

// Recipient Details (requirement 10) is only meaningful once a campaign has
// actually had its audience resolved and recipient rows written —
// insertCampaignWithRecipients (backend) runs for both send-now and
// schedule, so even a still-`scheduled` campaign already has them; 'draft'
// is the only status that never will (ComposeTab has no working Save Draft
// path yet — ditto CAMPAIGN_STATUS_OPTIONS's comment above).
function campaignHasRecipients(campaign) {
  return !!campaign && campaign.status !== 'draft' && (campaign.recipientCount ?? 0) > 0;
}

// Label/value row — the same two-column `dl` layout SendCampaignConfirmModal
// (below) already uses inline, factored out since Campaign Details has many
// more rows than that modal does.
function DetailRow({ label, value }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="max-w-[65%] text-right font-semibold text-ink">{value ?? '—'}</dd>
    </div>
  );
}

// Recipient Details (requirement 10) — reads marketing_campaign_recipients
// via GET /admin/marketing/campaigns/:id/recipients (paginated, same
// page/pageSize/total/totalPages shape every other admin list here uses).
function RecipientsModal({ campaign, onClose }) {
  const [recipients, setRecipients] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pageSize: 50, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    api
      .get(`/admin/marketing/campaigns/${campaign.id}/recipients?page=${page}`)
      .then(({ recipients: rows, pagination: p }) => {
        setRecipients(rows);
        setPagination(p);
      })
      .catch((err) => setError(err.message || 'Unable to load recipients'))
      .finally(() => setLoading(false));
  }, [campaign.id, page]);

  return (
    <Modal title={`Recipients — ${campaign.name}`} onClose={onClose} size="xl" footer={<Button onClick={onClose}>Close</Button>}>
      {error ? (
        <ErrorText>{error}</ErrorText>
      ) : loading ? (
        <p className="text-sm text-muted">Loading recipients…</p>
      ) : recipients.length === 0 ? (
        <p className="text-sm text-muted">No recipients recorded for this campaign.</p>
      ) : (
        <>
          <Table
            columns={[
              'Agency', 'Recipient', 'Status', 'Failure reason', 'Sent',
              'Opened', 'Opens', 'Clicked', 'Clicks', 'Provider message ID',
            ]}
            rows={recipients}
            renderRow={(r) => (
              <tr key={r.id} className="border-b border-line-light last:border-0">
                <td className="px-3 py-2 font-semibold">{r.agencyName || '—'}</td>
                <td className="px-3 py-2">{r.recipientAddress}</td>
                <td className="px-3 py-2">
                  <Badge tone={RECIPIENT_STATUS_TONE[r.status] || 'grey'}>{formatEnumLabel(r.status)}</Badge>
                </td>
                <td className="max-w-[220px] truncate px-3 py-2" title={r.failureReason || ''}>
                  {r.failureReason || '—'}
                </td>
                <td className="px-3 py-2">{formatDateTime(r.sentAt)}</td>
                {/* Task 11 (requirement 8) — real per-recipient open/click state, direct
                    from marketing_campaign_recipients (never a frontend-only counter). */}
                <td className="px-3 py-2">{formatDateTime(r.openedAt)}</td>
                <td className="px-3 py-2">{r.openCount}</td>
                <td className="px-3 py-2">{formatDateTime(r.clickedAt)}</td>
                <td className="px-3 py-2">{r.clickCount}</td>
                <td className="px-3 py-2 font-mono text-[10px]">{r.providerMessageId || '—'}</td>
              </tr>
            )}
          />
          {pagination.totalPages > 1 && (
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-muted">
                Page {pagination.page} of {pagination.totalPages} · {pagination.total} total
              </span>
              <div className="flex gap-2">
                <Button disabled={pagination.page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  Previous
                </Button>
                <Button disabled={pagination.page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}

// Campaign Details (requirement 9) — fetches the full record (GET
// /admin/marketing/campaigns/:id, which adds body/replyToAccountManager on
// top of the summary fields the History list row already shows) on open,
// rather than trusting the row passed in, so this always reflects the
// latest state. Cancel Schedule (requirement 11) reuses the exact same POST
// /admin/marketing/campaigns/:id/cancel Task 6's ComposeTab banner already
// calls — no second cancellation mechanism — and `onCancelled` lets
// CampaignHistoryTab below refetch its list once that actually succeeds
// (requirement 13).
function CampaignDetailModal({ campaignId, onClose, onCancelled }) {
  const toast = useToast();
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [showRecipients, setShowRecipients] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError('');
    api
      .get(`/admin/marketing/campaigns/${campaignId}`)
      .then(({ campaign: c }) => setCampaign(c))
      .catch((err) => setError(err.message || 'Unable to load campaign'))
      .finally(() => setLoading(false));
  }, [campaignId]);

  async function handleCancel() {
    setCancelling(true);
    try {
      await api.post(`/admin/marketing/campaigns/${campaignId}/cancel`);
      toast.success('Scheduled campaign cancelled — nothing will be sent.');
      onCancelled();
      onClose();
    } catch (err) {
      toast.error(err.message || 'Unable to cancel scheduled campaign');
    } finally {
      setCancelling(false);
    }
  }

  return (
    <>
      <Modal
        title="Campaign details"
        onClose={onClose}
        size="lg"
        footer={
          <>
            {campaign?.status === 'scheduled' && (
              <Button variant="danger" disabled={cancelling} onClick={handleCancel}>
                {cancelling ? 'Cancelling…' : 'Cancel Schedule'}
              </Button>
            )}
            {campaignHasRecipients(campaign) && <Button onClick={() => setShowRecipients(true)}>View Recipients</Button>}
            <Button onClick={onClose}>Close</Button>
          </>
        }
      >
        {error ? (
          <ErrorText>{error}</ErrorText>
        ) : loading || !campaign ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : (
          <dl className="space-y-2 text-sm">
            <DetailRow label="Campaign name" value={campaign.name} />
            <DetailRow label="Channel" value={CHANNEL_OPTIONS.find((c) => c.value === campaign.channel)?.label || campaign.channel} />
            <DetailRow label="Provider" value={PROVIDER_LABELS[campaign.provider] || campaign.provider} />
            <DetailRow label="Audience" value={formatAudienceLabel(campaign.audienceType, campaign.audienceValue)} />
            {campaign.channel === 'email' && <DetailRow label="Subject" value={campaign.subject || '—'} />}
            <div className="border-t border-line-light pt-2">
              <dt className="mb-1 text-muted">Message</dt>
              <dd className="whitespace-pre-wrap rounded-md border border-line-light bg-panel p-3 text-xs text-ink">{campaign.body}</dd>
            </div>
            {campaign.channel === 'email' && (
              <DetailRow label="Reply-to account manager" value={campaign.replyToAccountManager ? 'Yes' : 'No'} />
            )}
            <div className="flex justify-between gap-3 border-t border-line-light pt-2">
              <dt className="text-muted">Status</dt>
              <dd>
                <Badge tone={CAMPAIGN_STATUS_TONE[campaign.status] || 'grey'}>{formatEnumLabel(campaign.status)}</Badge>
              </dd>
            </div>
            <DetailRow label="Recipients" value={campaign.recipientCount} />
            <DetailRow label="Successful sends" value={campaign.successCount} />
            <DetailRow label="Failed sends" value={campaign.failureCount} />
            {/* Task 11 — open/click tracking only exists for the built-in SMTP (email)
                path; a WhatsApp campaign never shows these rows at all, rather than a
                fake 0 that would imply tracking exists for a channel it doesn't
                (requirement 10). Rates come straight from the backend (toPublicCampaign)
                — never computed here — and read "—" rather than "0%"/"NaN%" when there
                have been no successful sends yet to divide by. */}
            {campaign.channel === 'email' && (
              <>
                <DetailRow label="Open count" value={campaign.openCount} />
                <DetailRow label="Unique recipients who opened" value={campaign.uniqueOpens} />
                <DetailRow label="Open rate" value={campaign.openRate != null ? `${campaign.openRate}%` : '—'} />
                <DetailRow label="Click count" value={campaign.clickCount} />
                <DetailRow label="Unique recipients who clicked" value={campaign.uniqueClicks} />
                <DetailRow label="Click rate" value={campaign.clickRate != null ? `${campaign.clickRate}%` : '—'} />
              </>
            )}
            <DetailRow label="Created" value={formatDateTime(campaign.createdAt)} />
            {campaign.scheduledAt && <DetailRow label="Scheduled" value={formatDateTime(campaign.scheduledAt)} />}
            {campaign.sentAt && <DetailRow label="Sent" value={formatDateTime(campaign.sentAt)} />}
          </dl>
        )}
      </Modal>

      {showRecipients && campaign && <RecipientsModal campaign={campaign} onClose={() => setShowRecipients(false)} />}
    </>
  );
}

// Campaign History tab (requirement 1–8, 11–13) — real marketing_campaigns
// rows via GET /admin/marketing/campaigns (search by name, status/channel
// filters, pagination), same list-page shape QuoteInbox.jsx already
// established for other admin history lists. Mounted fresh every time the
// admin switches into this tab (Marketing's own tab switch below unmounts
// the previous tab's content), which is what satisfies requirement 13 (the
// list reflecting the latest state after a send/schedule/cancel elsewhere
// in Compose) without any cross-tab state plumbing — plus an explicit
// Refresh button for refreshing without leaving the tab.
function CampaignHistoryTab() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [channel, setChannel] = useState('');
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);

  const [campaigns, setCampaigns] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pageSize: 20, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedCampaignId, setSelectedCampaignId] = useState(null);

  // Filter setters reset to page 1 in the same tick — same reason
  // QuoteInbox.jsx's updateSearch/updateStatus/etc. do this (one fetch per
  // filter change, never a stale-page fetch followed immediately by a reset
  // one).
  function updateSearch(v) {
    setSearch(v);
    setPage(1);
  }
  function updateStatus(v) {
    setStatus(v);
    setPage(1);
  }
  function updateChannel(v) {
    setChannel(v);
    setPage(1);
  }

  useEffect(() => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (status) params.set('status', status);
    if (channel) params.set('channel', channel);
    params.set('page', String(page));

    api
      .get(`/admin/marketing/campaigns?${params.toString()}`)
      .then(({ campaigns: rows, pagination: p }) => {
        setCampaigns(rows);
        setPagination(p);
      })
      .catch((err) => setError(err.message || 'Unable to load campaign history'))
      .finally(() => setLoading(false));
  }, [search, status, channel, page, refreshKey]);

  return (
    <div className="space-y-4">
      <Card className="border-white">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <TextInput
            className="lg:col-span-2"
            placeholder="Search campaign name…"
            value={search}
            onChange={(e) => updateSearch(e.target.value)}
          />
          <Select value={status} onChange={(e) => updateStatus(e.target.value)}>
            {CAMPAIGN_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <Select value={channel} onChange={(e) => updateChannel(e.target.value)}>
            <option value="">All channels</option>
            {CHANNEL_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="mt-3 flex justify-end border-t border-line-light pt-3">
          <Button onClick={() => setRefreshKey((k) => k + 1)} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </Button>
        </div>
      </Card>

      {error ? (
        <ErrorText>{error}</ErrorText>
      ) : loading ? (
        <Card className="border-white">
          <p className="py-10 text-center text-sm text-muted">Loading campaign history…</p>
        </Card>
      ) : campaigns.length === 0 ? (
        <EmptyTabState
          description={
            search || status || channel
              ? 'No campaigns match those filters.'
              : 'Campaigns you send or schedule from Compose will show up here.'
          }
        />
      ) : (
        <>
          <Table
            columns={[
              'Campaign', 'Channel', 'Provider', 'Audience', 'Status', 'Recipients', 'Success', 'Failed',
              'Opens', 'Clicks', 'Created', 'Scheduled', 'Sent', '',
            ]}
            rows={campaigns}
            renderRow={(c) => (
              <tr key={c.id} className="border-b border-line-light last:border-0">
                <td className="px-3 py-2 font-semibold">{c.name}</td>
                <td className="px-3 py-2">{CHANNEL_OPTIONS.find((o) => o.value === c.channel)?.label || c.channel}</td>
                <td className="px-3 py-2">{PROVIDER_LABELS[c.provider] || c.provider}</td>
                <td className="px-3 py-2">{formatAudienceLabel(c.audienceType, c.audienceValue)}</td>
                <td className="px-3 py-2">
                  <Badge tone={CAMPAIGN_STATUS_TONE[c.status] || 'grey'}>{formatEnumLabel(c.status)}</Badge>
                </td>
                <td className="px-3 py-2">{c.recipientCount}</td>
                <td className="px-3 py-2">{c.successCount}</td>
                <td className="px-3 py-2">{c.failureCount}</td>
                {/* Task 11 — only the built-in SMTP (email) path ever tracks opens/clicks; a
                    WhatsApp campaign shows "—", never a fake 0 that would read as "tracked, but
                    nobody opened it" (requirement 10). */}
                <td className="px-3 py-2">{c.channel === 'email' ? c.uniqueOpens : '—'}</td>
                <td className="px-3 py-2">{c.channel === 'email' ? c.uniqueClicks : '—'}</td>
                <td className="px-3 py-2">{formatDateTime(c.createdAt)}</td>
                <td className="px-3 py-2">{formatDateTime(c.scheduledAt)}</td>
                <td className="px-3 py-2">{formatDateTime(c.sentAt)}</td>
                <td className="px-3 py-2 text-right">
                  <button type="button" onClick={() => setSelectedCampaignId(c.id)} className="text-accent hover:underline">
                    View
                  </button>
                </td>
              </tr>
            )}
          />

          <div className="flex items-center justify-between">
            <span className="text-xs text-muted">
              Page {pagination.page} of {pagination.totalPages} · {pagination.total} total
            </span>
            <div className="flex gap-2">
              <Button disabled={pagination.page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                Previous
              </Button>
              <Button disabled={pagination.page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        </>
      )}

      {selectedCampaignId && (
        <CampaignDetailModal
          campaignId={selectedCampaignId}
          onClose={() => setSelectedCampaignId(null)}
          onCancelled={() => setRefreshKey((k) => k + 1)}
        />
      )}
    </div>
  );
}

// Channel Settings (Task 9) — GET /admin/marketing/channels, fetched once
// and shared by ChannelSettingsTab (the full provider list + Test
// Connection) and ComposeTab's own ChannelSection below (just the currently
// selected provider's status) — one request, one source of truth, so the
// two screens can never disagree about what "Connected" means.
function useChannelStatuses() {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError('');
    api
      .get('/admin/marketing/channels')
      .then(({ providers: rows }) => setProviders(rows || []))
      .catch((err) => setError(err.message || 'Unable to load channel status'))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const byProvider = Object.fromEntries(providers.map((p) => [p.provider, p]));

  return { providers, byProvider, loading, error, refresh: () => setRefreshKey((k) => k + 1) };
}

// Channel + Provider — picking the channel narrows the provider list to
// that channel's options (Email: Mailchimp/Zoho Campaigns/Built-in sender;
// WhatsApp: WhatsApp Business API only), and the selected provider's real,
// backend-verified status (Task 9) is shown underneath — `statusInfo` is
// `byProvider[provider]` from useChannelStatuses above, fetched once by
// ComposeTab and passed down here.
function ChannelSection({ channel, onChannelChange, provider, onProviderChange, statusInfo, statusLoading, statusError }) {
  const providers = PROVIDER_OPTIONS[channel] || [];
  const statusMeta = statusInfo ? PROVIDER_STATUS_META[statusInfo.status] || PROVIDER_STATUS_META.not_implemented : null;

  return (
    <Card label="Channel" className="border-white">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <FieldLabel>Channel</FieldLabel>
          <Select value={channel} onChange={(e) => onChannelChange(e.target.value)}>
            {CHANNEL_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <FieldLabel>Provider</FieldLabel>
          <Select value={provider} onChange={(e) => onProviderChange(e.target.value)}>
            {providers.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line-light pt-4">
        <span className="text-[11px] font-semibold uppercase text-muted">Status</span>
        {statusLoading ? (
          <span className="text-xs text-muted">Checking…</span>
        ) : statusError ? (
          <span className="text-xs text-[#a5162d]">{statusError}</span>
        ) : statusMeta ? (
          <>
            <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
            {statusInfo?.message && <span className="text-xs text-muted">{statusInfo.message}</span>}
          </>
        ) : null}
      </div>
    </Card>
  );
}

// Fetches the real approved-agency data once — shared by AudienceSection's
// display and the Send Campaign confirmation modal's recipient count, so
// both read the exact same numbers rather than fetching/computing them
// twice and risking drift. Same GET /admin/agencies endpoint (plus the
// inactiveSinceDays filter) Task 3 already established.
function useApprovedAgencies() {
  const [agencies, setAgencies] = useState([]);
  const [inactiveCount, setInactiveCount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    Promise.all([
      api.get('/admin/agencies?status=approved'),
      api.get(`/admin/agencies?status=approved&inactiveSinceDays=${INACTIVE_SINCE_DAYS}`),
    ])
      .then(([all, inactive]) => {
        setAgencies(all.agencies || []);
        setInactiveCount((inactive.agencies || []).length);
      })
      .catch((err) => setError(err.message || 'Unable to load agency data'))
      .finally(() => setLoading(false));
  }, []);

  return { agencies, inactiveCount, loading, error };
}

// Audience — who a campaign would go to. Entirely channel-independent (the
// same segment picker and counts apply whether Email or WhatsApp is
// selected — "works for both channels", not that it changes per channel).
// Fully controlled by ComposeTab now (audienceType/tier/country + the fetched
// agency data) so Send Campaign's confirmation modal can read the exact same
// selection and recipient count this card is showing — but the state itself
// stays its own separate slice, never merged into Channel's.
function AudienceSection({
  audienceType,
  onAudienceTypeChange,
  tier,
  onTierChange,
  onCountryChange,
  countryOptions,
  effectiveCountry,
  recipientCount,
  loading,
  error,
}) {
  return (
    <Card label="Audience" className="border-white">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <FieldLabel>Audience</FieldLabel>
          <Select value={audienceType} onChange={(e) => onAudienceTypeChange(e.target.value)}>
            {AUDIENCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>

        {audienceType === 'tier' && (
          <div>
            <FieldLabel>Tier</FieldLabel>
            <Select value={tier} onChange={(e) => onTierChange(e.target.value)}>
              {TIERS.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </Select>
          </div>
        )}

        {audienceType === 'country' &&
          (countryOptions.length === 0 && !loading ? (
            <div>
              <FieldLabel>Country</FieldLabel>
              <p className="text-xs text-muted">No approved agencies have a country on file yet.</p>
            </div>
          ) : (
            <div>
              <FieldLabel>Country</FieldLabel>
              <Select value={effectiveCountry} onChange={(e) => onCountryChange(e.target.value)}>
                {countryOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </div>
          ))}
      </div>

      <div className="mt-4 border-t border-line-light pt-4">
        <FieldLabel>Recipients</FieldLabel>
        {error ? (
          <ErrorText>{error}</ErrorText>
        ) : loading ? (
          <p className="text-sm text-muted">Calculating…</p>
        ) : (
          <p className="text-2xl font-bold text-ink">
            {recipientCount ?? '—'} {recipientCount === 1 ? 'agency' : 'agencies'}
          </p>
        )}
        <p className="mt-1 text-xs text-muted">
          Live count from approved agencies{audienceType === 'inactive_30d' ? ` with no activity in the last ${INACTIVE_SINCE_DAYS} days` : ''} — the
          backend recomputes this independently at send time, this is a preview.
        </p>
      </div>
    </Card>
  );
}

// Message — reacts to (reads, never mutates) the Channel via the `channel`
// prop; subject/body/reply-to are lifted to ComposeTab (so Send Test/Send
// Campaign can read them) but remain their own separate state slice, never
// merged with Channel's or Audience's. Email shows Subject + Body + the
// reply-to checkbox; WhatsApp shows only Body. Toggling channel can never
// leave a stale "Subject is required" error sitting around for WhatsApp —
// that field (and its validation) only ever renders while channel ===
// 'email', derived live rather than cleared/reset on switch.
function MessageSection({
  channel,
  subject,
  onSubjectChange,
  subjectTouched,
  onSubjectBlur,
  body,
  onBodyChange,
  bodyTouched,
  onBodyBlur,
  replyToAccountManager,
  onReplyToAccountManagerChange,
}) {
  const isEmail = channel === 'email';
  const subjectError = isEmail && subjectTouched && !subject.trim() ? 'Subject is required.' : '';
  const bodyError = bodyTouched && !body.trim() ? 'Message body is required.' : '';

  return (
    <Card label="Message" className="border-white">
      <div className="space-y-4">
        {isEmail && (
          <div>
            <div className="flex items-baseline justify-between">
              <FieldLabel>Subject / Preview line *</FieldLabel>
              <span className="text-[10px] text-muted">
                {subject.length}/{EMAIL_SUBJECT_MAX_LENGTH}
              </span>
            </div>
            <TextInput
              placeholder="Campaign subject line"
              value={subject}
              maxLength={EMAIL_SUBJECT_MAX_LENGTH}
              onChange={(e) => onSubjectChange(e.target.value)}
              onBlur={onSubjectBlur}
            />
            <p className="mt-1 text-[11px] text-muted">Keep it under ~60 characters so it isn't cut off in most inboxes.</p>
            <ErrorText>{subjectError}</ErrorText>
          </div>
        )}

        <div>
          <FieldLabel>{isEmail ? 'Body *' : 'WhatsApp message *'}</FieldLabel>
          <Textarea
            rows={8}
            placeholder={isEmail ? 'Write the campaign message…' : 'Write the WhatsApp message…'}
            value={body}
            onChange={(e) => onBodyChange(e.target.value)}
            onBlur={onBodyBlur}
          />
          <ErrorText>{bodyError}</ErrorText>
        </div>

        {isEmail && (
          <div className="border-t border-line-light pt-4">
            <Checkbox
              checked={replyToAccountManager}
              onChange={onReplyToAccountManagerChange}
              label="Include agency's assigned account manager as reply-to"
            />
            <p className="mt-1 pl-6 text-[11px] text-muted">
              Each agency's copy uses that agency's own assigned Relationship Manager as Reply-To — never one shared
              address for everyone. Agencies with no assigned manager send without a Reply-To.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}

// Send Test — a single, one-off send using whatever Provider/Subject/Body is
// currently composed; never touches the audience (POST
// /admin/marketing/send-test, no campaign/recipient rows created — see the
// backend's marketing.controller.js#sendTest). Only Email + Built-in sender
// is actually wired up — every other provider shows a plain "needs
// configuring" message instead of a form that would go nowhere.
function SendTestModal({ channel, provider, subject, body, defaultEmail, onClose }) {
  const toast = useToast();
  const [email, setEmail] = useState(defaultEmail || '');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const canSendReal = channel === 'email' && provider === 'built_in';

  async function handleSend() {
    const trimmed = email.trim();
    if (!EMAIL_PATTERN.test(trimmed)) {
      setError('Enter a valid email address.');
      return;
    }
    setError('');
    setSending(true);
    try {
      await api.post('/admin/marketing/send-test', { channel, provider, subject, body, recipientEmail: trimmed });
      toast.success(`Test email sent to ${trimmed}.`);
      onClose();
    } catch (err) {
      const message = err.message || 'Unable to send test email';
      setError(message);
      toast.error(message);
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal
      title="Send test"
      onClose={onClose}
      footer={
        canSendReal ? (
          <>
            <Button onClick={onClose} disabled={sending}>
              Cancel
            </Button>
            <Button variant="accent" disabled={sending} onClick={handleSend}>
              {sending ? 'Sending…' : 'Send Test'}
            </Button>
          </>
        ) : (
          <Button onClick={onClose}>Close</Button>
        )
      }
    >
      {canSendReal ? (
        <>
          <FieldLabel>Send this test to</FieldLabel>
          <TextInput
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@xclusiveoman.com"
            disabled={sending}
          />
          <p className="mt-2 text-xs text-muted">
            Uses the current Provider ({PROVIDER_LABELS[provider]}), Subject, and Message body exactly as composed —
            this does not send to the selected audience.
          </p>
          <ErrorText>{error}</ErrorText>
        </>
      ) : (
        <p className="text-sm text-muted">
          {PROVIDER_LABELS[provider] || provider} isn't connected yet — configure it in Channel Settings before you
          can send a test.
        </p>
      )}
    </Modal>
  );
}

// Confirmation before an actual Send Campaign or Schedule Campaign — the
// recipientCount shown here is the same live preview AudienceSection shows
// (display only): the backend independently resolves the real recipient set
// and count itself at send time (marketing.controller.js#createCampaign /
// #scheduleCampaign) and never trusts this number. `mode` ('send' |
// 'schedule') only changes copy/labels — same modal, same fields, per
// Task 6's example format plus one extra "Scheduled" row when scheduling.
function SendCampaignConfirmModal({
  mode,
  channel,
  provider,
  audienceLabel,
  recipientCount,
  subject,
  scheduledLabel,
  sending,
  onCancel,
  onConfirm,
}) {
  const isSchedule = mode === 'schedule';
  const recipients = `${recipientCount ?? '—'} ${recipientCount === 1 ? 'agency' : 'agencies'}`;
  return (
    <Modal
      title={isSchedule ? `Schedule campaign for ${recipients}?` : `Send campaign to ${recipients}?`}
      onClose={onCancel}
      footer={
        <>
          <Button onClick={onCancel} disabled={sending}>
            Cancel
          </Button>
          <Button variant="accent" disabled={sending} onClick={onConfirm}>
            {sending ? (isSchedule ? 'Scheduling…' : 'Sending…') : isSchedule ? 'Schedule Campaign' : 'Confirm & Send'}
          </Button>
        </>
      }
    >
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Channel</dt>
          <dd className="font-semibold text-ink">{CHANNEL_OPTIONS.find((c) => c.value === channel)?.label}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Provider</dt>
          <dd className="font-semibold text-ink">{PROVIDER_LABELS[provider]}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Audience</dt>
          <dd className="font-semibold text-ink">{audienceLabel}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Recipients</dt>
          <dd className="font-semibold text-ink">{recipients}</dd>
        </div>
        {channel === 'email' && (
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Subject</dt>
            <dd className="max-w-[60%] truncate text-right font-semibold text-ink">{subject || '—'}</dd>
          </div>
        )}
        {isSchedule && (
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Scheduled</dt>
            <dd className="font-semibold text-ink">{scheduledLabel}</dd>
          </div>
        )}
      </dl>
    </Modal>
  );
}

// Compose — the default tab. Channel/Provider, Audience, and Message each
// keep their own state slice (lifted here only so Send Test/Send Campaign
// can read them, per requirement — never merged into one shared object);
// this component is the only place that knows about all of them together,
// for the actual send/schedule actions.
function ComposeTab() {
  const { user } = useAuth();
  const toast = useToast();

  const [name, setName] = useState('');
  const [nameTouched, setNameTouched] = useState(false);
  const [channel, setChannel] = useState('email');
  const [provider, setProvider] = useState(PROVIDER_OPTIONS.email[0].value);

  const [audienceType, setAudienceType] = useState('all');
  const [tier, setTier] = useState(TIERS[0]);
  const [country, setCountry] = useState('');

  const [subject, setSubject] = useState('');
  const [subjectTouched, setSubjectTouched] = useState(false);
  const [body, setBody] = useState('');
  const [bodyTouched, setBodyTouched] = useState(false);
  const [replyToAccountManager, setReplyToAccountManager] = useState(false);

  // Schedule (Task 6) — 'now' preserves the exact Task 5 flow unchanged;
  // 'later' reveals date/time/timezone and switches the primary action to
  // Schedule Campaign instead of Send Campaign.
  const [scheduleMode, setScheduleMode] = useState('now');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [scheduledTimezone, setScheduledTimezone] = useState(DEFAULT_TIMEZONE);
  const [scheduleTouched, setScheduleTouched] = useState(false);

  const [showSendTest, setShowSendTest] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // The campaign just scheduled (if any) — the only place Cancel Schedule is
  // reachable this task (no Campaign History list exists yet to browse past
  // scheduled campaigns and cancel one there).
  const [scheduledCampaign, setScheduledCampaign] = useState(null); // { id, label }
  const [cancellingSchedule, setCancellingSchedule] = useState(false);

  const { agencies, inactiveCount, loading: agenciesLoading, error: agenciesError } = useApprovedAgencies();
  const { byProvider: channelStatusByProvider, loading: channelStatusLoading, error: channelStatusError } = useChannelStatuses();

  // Switching channel resets the provider to that channel's first option —
  // e.g. Zoho Campaigns (an email provider) can't stay selected once the
  // channel is switched to WhatsApp.
  function handleChannelChange(nextChannel) {
    setChannel(nextChannel);
    setProvider(PROVIDER_OPTIONS[nextChannel][0].value);
  }

  const countryOptions = Array.from(new Set(agencies.map((a) => a.country).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  const effectiveCountry = country || countryOptions[0] || '';
  const recipientCount =
    audienceType === 'all'
      ? agencies.length
      : audienceType === 'tier'
        ? agencies.filter((a) => a.tier === tier).length
        : audienceType === 'country'
          ? agencies.filter((a) => a.country === effectiveCountry).length
          : inactiveCount;

  const isEmail = channel === 'email';
  const isSchedule = scheduleMode === 'later';
  const nameError = nameTouched && !name.trim() ? 'Campaign name is required.' : '';
  const scheduleDateTimeValid = !isSchedule || isFutureLocal(scheduledDate, scheduledTime);
  const scheduleError =
    isSchedule && scheduleTouched && (!scheduledDate || !scheduledTime)
      ? 'Pick a scheduled date and time.'
      : isSchedule && scheduleTouched && !scheduleDateTimeValid
        ? 'Scheduled time must be in the future.'
        : '';
  // Gates both Send Campaign and Schedule Campaign (requirement: validate
  // name/channel/provider/audience/subject-for-email/body before either can
  // even be attempted — channel/provider are always valid since they come
  // from fixed selects) plus, only in schedule mode, a future date/time.
  const canSubmitCampaign =
    !!name.trim() &&
    !!body.trim() &&
    (!isEmail || !!subject.trim()) &&
    (audienceType !== 'country' || !!effectiveCountry) &&
    scheduleDateTimeValid;

  function resetComposeForm() {
    setName('');
    setNameTouched(false);
    setChannel('email');
    setProvider(PROVIDER_OPTIONS.email[0].value);
    setAudienceType('all');
    setTier(TIERS[0]);
    setCountry('');
    setSubject('');
    setSubjectTouched(false);
    setBody('');
    setBodyTouched(false);
    setReplyToAccountManager(false);
    setScheduleMode('now');
    setScheduledDate('');
    setScheduledTime('');
    setScheduledTimezone(DEFAULT_TIMEZONE);
    setScheduleTouched(false);
  }

  async function handleConfirmSend() {
    setSubmitting(true);
    try {
      const { campaign, configurationError } = await api.post('/admin/marketing/campaigns', {
        name: name.trim(),
        channel,
        provider,
        audienceType,
        audienceValue: audienceType === 'tier' ? tier : audienceType === 'country' ? effectiveCountry : undefined,
        subject: isEmail ? subject.trim() : undefined,
        body,
        replyToAccountManager,
      });
      if (configurationError) {
        toast.error(configurationError);
      } else if (campaign.status === 'sent') {
        toast.success(`Campaign sent to ${campaign.successCount} of ${campaign.recipientCount} agencies.`);
      } else if (campaign.status === 'partially_failed') {
        toast.error(`Sent to ${campaign.successCount} of ${campaign.recipientCount} agencies — ${campaign.failureCount} failed.`);
      } else {
        toast.error(`Campaign could not be sent to any of its ${campaign.recipientCount} recipients.`);
      }
      // A campaign record was created either way (even a fully-failed one is
      // a real, persisted attempt) — the request itself succeeded, so the
      // form resets. Only an actual request failure (caught below) leaves
      // it untouched.
      setShowConfirm(false);
      resetComposeForm();
    } catch (err) {
      toast.error(err.message || 'Unable to send campaign');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmSchedule() {
    setSubmitting(true);
    try {
      const { campaign } = await api.post('/admin/marketing/campaigns/schedule', {
        name: name.trim(),
        channel,
        provider,
        audienceType,
        audienceValue: audienceType === 'tier' ? tier : audienceType === 'country' ? effectiveCountry : undefined,
        subject: isEmail ? subject.trim() : undefined,
        body,
        replyToAccountManager,
        scheduledDate,
        scheduledTime,
        scheduledTimezone,
      });
      const label = formatScheduledLabel(scheduledDate, scheduledTime, scheduledTimezone);
      toast.success(`Campaign scheduled for ${label}.`);
      setScheduledCampaign({ id: campaign.id, label });
      setShowConfirm(false);
      resetComposeForm();
    } catch (err) {
      // Nothing was created — form stays exactly as the admin left it.
      toast.error(err.message || 'Unable to schedule campaign');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancelSchedule() {
    if (!scheduledCampaign) return;
    setCancellingSchedule(true);
    try {
      await api.post(`/admin/marketing/campaigns/${scheduledCampaign.id}/cancel`);
      toast.success('Scheduled campaign cancelled — nothing will be sent.');
      setScheduledCampaign(null);
    } catch (err) {
      toast.error(err.message || 'Unable to cancel scheduled campaign');
    } finally {
      setCancellingSchedule(false);
    }
  }

  const audienceLabel =
    audienceType === 'tier'
      ? `By Tier — ${tier.charAt(0).toUpperCase() + tier.slice(1)}`
      : audienceType === 'country'
        ? `By Country — ${effectiveCountry || '—'}`
        : audienceType === 'inactive_30d'
          ? 'Inactive 30+ days'
          : 'All Agents';

  return (
    <div className="space-y-4">
      {scheduledCampaign && (
        <Card label="Campaign scheduled" className="border-white">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink">
              Scheduled for <span className="font-semibold">{scheduledCampaign.label}</span> — nothing has been sent yet.
            </p>
            <div className="flex items-center gap-3">
              <Button variant="danger" disabled={cancellingSchedule} onClick={handleCancelSchedule}>
                {cancellingSchedule ? 'Cancelling…' : 'Cancel Schedule'}
              </Button>
              <button
                type="button"
                onClick={() => setScheduledCampaign(null)}
                className="text-xs text-muted hover:text-ink"
              >
                Dismiss
              </button>
            </div>
          </div>
        </Card>
      )}

      <ChannelSection
        channel={channel}
        onChannelChange={handleChannelChange}
        provider={provider}
        onProviderChange={setProvider}
        statusInfo={channelStatusByProvider[provider]}
        statusLoading={channelStatusLoading}
        statusError={channelStatusError}
      />

      <AudienceSection
        audienceType={audienceType}
        onAudienceTypeChange={setAudienceType}
        tier={tier}
        onTierChange={setTier}
        onCountryChange={setCountry}
        countryOptions={countryOptions}
        effectiveCountry={effectiveCountry}
        recipientCount={recipientCount}
        loading={agenciesLoading}
        error={agenciesError}
      />

      <MessageSection
        channel={channel}
        subject={subject}
        onSubjectChange={setSubject}
        subjectTouched={subjectTouched}
        onSubjectBlur={() => setSubjectTouched(true)}
        body={body}
        onBodyChange={setBody}
        bodyTouched={bodyTouched}
        onBodyBlur={() => setBodyTouched(true)}
        replyToAccountManager={replyToAccountManager}
        onReplyToAccountManagerChange={setReplyToAccountManager}
      />

      <Card label="New campaign" className="border-white">
        <div>
          <FieldLabel>Campaign name</FieldLabel>
          <TextInput
            placeholder="e.g. October Oman FIT Push"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => setNameTouched(true)}
          />
          <ErrorText>{nameError}</ErrorText>
        </div>

        <div className="mt-4 border-t border-line-light pt-4">
          <FieldLabel>Schedule</FieldLabel>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setScheduleMode('now')}>
              <Tag active={scheduleMode === 'now'}>Send now</Tag>
            </button>
            <button type="button" onClick={() => setScheduleMode('later')}>
              <Tag active={isSchedule}>Schedule for later</Tag>
            </button>
          </div>

          {isSchedule && (
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <FieldLabel>Scheduled date</FieldLabel>
                <TextInput
                  type="date"
                  min={todayLocalDateString()}
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  onBlur={() => setScheduleTouched(true)}
                />
              </div>
              <div>
                <FieldLabel>Scheduled time</FieldLabel>
                <TextInput
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  onBlur={() => setScheduleTouched(true)}
                />
              </div>
              <div>
                <FieldLabel>Timezone</FieldLabel>
                <Select value={scheduledTimezone} onChange={(e) => setScheduledTimezone(e.target.value)}>
                  {TIMEZONE_OPTIONS.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="sm:col-span-3">
                <ErrorText>{scheduleError}</ErrorText>
              </div>
            </div>
          )}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line-light pt-4">
          <Button disabled title="Not available yet">
            Save Draft
          </Button>
          <Button onClick={() => setShowSendTest(true)}>Send Test</Button>
          <Button variant="accent" disabled={!canSubmitCampaign || submitting} onClick={() => setShowConfirm(true)}>
            {submitting ? (isSchedule ? 'Scheduling…' : 'Sending…') : isSchedule ? 'Schedule Campaign' : 'Send Campaign'}
          </Button>
          {!canSubmitCampaign && (
            <span className="text-xs text-muted">
              Campaign name, {isEmail ? 'subject, ' : ''}message body{audienceType === 'country' ? ', and a country' : ''}
              {isSchedule ? ', and a future scheduled date/time' : ''} are required before {isSchedule ? 'scheduling' : 'sending'}.
            </span>
          )}
        </div>
      </Card>

      {showSendTest && (
        <SendTestModal
          channel={channel}
          provider={provider}
          subject={subject}
          body={body}
          defaultEmail={user?.email || ''}
          onClose={() => setShowSendTest(false)}
        />
      )}

      {showConfirm && (
        <SendCampaignConfirmModal
          mode={isSchedule ? 'schedule' : 'send'}
          channel={channel}
          provider={provider}
          audienceLabel={audienceLabel}
          recipientCount={recipientCount}
          subject={subject}
          scheduledLabel={isSchedule ? formatScheduledLabel(scheduledDate, scheduledTime, scheduledTimezone) : ''}
          sending={submitting}
          onCancel={() => setShowConfirm(false)}
          onConfirm={isSchedule ? handleConfirmSchedule : handleConfirmSend}
        />
      )}
    </div>
  );
}

// One provider's row within ChannelSettingsTab below — label, real status
// badge, explanatory message, and (built_in only, today) a Test Connection
// action. Mailchimp/Zoho Campaigns/WhatsApp Business API show their
// 'not_implemented' status with no action button at all — there is nothing
// to configure or test yet, so no "Configure" button that would go nowhere.
function ProviderRow({ providerInfo, onTest, testing }) {
  const statusMeta = PROVIDER_STATUS_META[providerInfo.status] || PROVIDER_STATUS_META.not_implemented;
  const canTest = providerInfo.provider === 'built_in';

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-light py-3 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink">{providerInfo.label}</p>
        {providerInfo.message && <p className="mt-0.5 max-w-md text-xs text-muted">{providerInfo.message}</p>}
      </div>
      <div className="flex flex-none items-center gap-3">
        <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
        {canTest && (
          <Button onClick={onTest} disabled={testing}>
            {testing ? 'Testing…' : 'Test Connection'}
          </Button>
        )}
      </div>
    </div>
  );
}

// Channel Settings tab (Task 9) — replaces the old "Coming soon" placeholder
// with the real GET /admin/marketing/channels status for every provider
// Compose's own Channel card offers, grouped the same way that card groups
// them (Email / WhatsApp). "Test Connection" (built_in only — see
// ProviderRow above) hits POST /admin/marketing/channels/:provider/test-connection,
// the same backend computation the GET already reports, run fresh on
// demand; the provider secret (SMTP password) never leaves the server —
// this only ever receives back a status string + a sanitized message.
function ChannelSettingsTab() {
  const toast = useToast();
  const { providers, loading, error, refresh } = useChannelStatuses();
  const [testingProvider, setTestingProvider] = useState(null);

  async function handleTest(provider) {
    setTestingProvider(provider);
    try {
      const result = await api.post(`/admin/marketing/channels/${provider}/test-connection`);
      if (result.status === 'connected') {
        toast.success('Connection verified.');
      } else {
        toast.error(result.message || 'Connection could not be verified.');
      }
      refresh();
    } catch (err) {
      toast.error(err.message || 'Unable to test this connection');
    } finally {
      setTestingProvider(null);
    }
  }

  const emailProviders = providers.filter((p) => p.channel === 'email');
  const whatsappProviders = providers.filter((p) => p.channel === 'whatsapp');

  return (
    <div className="space-y-4">
      {error ? (
        <ErrorText>{error}</ErrorText>
      ) : loading ? (
        <Card className="border-white">
          <p className="py-10 text-center text-sm text-muted">Checking provider configuration…</p>
        </Card>
      ) : providers.length === 0 ? (
        <EmptyTabState description="No marketing channels are available." />
      ) : (
        <>
          <Card label="Email" className="border-white">
            {emailProviders.map((p) => (
              <ProviderRow key={p.provider} providerInfo={p} onTest={() => handleTest(p.provider)} testing={testingProvider === p.provider} />
            ))}
          </Card>
          <Card label="WhatsApp" className="border-white">
            {whatsappProviders.map((p) => (
              <ProviderRow key={p.provider} providerInfo={p} onTest={() => handleTest(p.provider)} testing={testingProvider === p.provider} />
            ))}
          </Card>
        </>
      )}
    </div>
  );
}

// --- Audience Segments (Task 10) ---
//
// Same four segments Compose's own AudienceSection/audienceLabel and the
// backend's resolveAudience() (services/marketingSend.service.js, via
// models/marketingCampaigns.model.js) already define — this tab is a
// browse/preview surface over that exact same definition, not a second one.
// Every count and every recipient list here comes from GET /admin/agencies
// (extended, Task 10, to forward tier/country query params — listAgencies()
// itself already accepted them, being the one function resolveAudience()
// also calls), the same endpoint Compose's own useApprovedAgencies() hook
// (above) already uses for its own live preview count — so a segment's
// shown count/members here can never drift from what sending a campaign to
// it would actually do. No "saved segment" database model exists or was
// added: the project documentation never specifies one, and these four
// definitions are fixed/built-in, not admin-authorable.

// Same status/tone convention AgentApprovals.jsx's own STATUS_BADGE already
// uses for this exact agencies.status enum — not a separately invented one.
const AGENCY_STATUS_TONE = {
  pending: 'amber',
  approved: 'green',
  rejected: 'red',
  suspended: 'grey',
};

// The real, server-authoritative query for one segment's matching agencies
// — always `status=approved` (every audience segment is scoped to approved
// agencies only, same as resolveAudience()) plus whichever single extra
// filter that segment's type adds. `search` (requirement 8) narrows this
// same request further, server-side (admin.controller.js#getAgencies) —
// never a client-side re-filter of an already-fetched broader list. Takes
// `type`/`value` as separate primitives (rather than the whole `segment`
// object) so SegmentDetailModal's own useEffect below can depend on exactly
// what this function reads, no more and no less.
function buildSegmentQueryString(type, value, search) {
  const params = new URLSearchParams();
  params.set('status', 'approved');
  if (type === 'tier') params.set('tier', value);
  if (type === 'country') params.set('country', value);
  if (type === 'inactive_30d') params.set('inactiveSinceDays', String(INACTIVE_SINCE_DAYS));
  if (search) params.set('search', search);
  return params.toString();
}

// One segment's matching agencies — Agency/Owner/Email/Country/Tier/Status
// (requirement 7), real backend data only, same "never mock recipients"
// posture Campaign History's own RecipientsModal already takes. Search
// re-queries the backend on every change (same pattern CampaignHistoryTab's
// own search already uses, requirement 8) rather than filtering an
// already-fetched list in the browser, so what's shown is always exactly
// what the backend just computed.
function SegmentDetailModal({ segment, onClose }) {
  const [search, setSearch] = useState('');
  const [agencies, setAgencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    api
      .get(`/admin/agencies?${buildSegmentQueryString(segment.type, segment.value, search)}`)
      .then(({ agencies: rows }) => setAgencies(rows))
      .catch((err) => setError(err.message || 'Unable to load agencies'))
      .finally(() => setLoading(false));
  }, [segment.type, segment.value, search]);

  return (
    <Modal title={segment.label} onClose={onClose} size="xl" footer={<Button onClick={onClose}>Close</Button>}>
      <p className="mb-3 text-xs text-muted">{segment.criteria}</p>
      <TextInput
        className="mb-3"
        placeholder="Search agency, owner name, or email…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {error ? (
        <ErrorText>{error}</ErrorText>
      ) : loading ? (
        <p className="text-sm text-muted">Loading agencies…</p>
      ) : agencies.length === 0 ? (
        <p className="text-sm text-muted">
          {search ? 'No agencies match that search.' : 'No approved agencies currently match this segment.'}
        </p>
      ) : (
        <>
          <Table
            columns={['Agency', 'Owner', 'Email', 'Country', 'Tier', 'Status']}
            rows={agencies}
            renderRow={(a) => (
              <tr key={a.id} className="border-b border-line-light last:border-0">
                <td className="px-3 py-2 font-semibold">{a.name}</td>
                <td className="px-3 py-2">{a.ownerName || '—'}</td>
                <td className="px-3 py-2">{a.ownerEmail || '—'}</td>
                <td className="px-3 py-2">{a.country || '—'}</td>
                <td className="px-3 py-2">{a.tier ? formatEnumLabel(a.tier) : '—'}</td>
                <td className="px-3 py-2">
                  <Badge tone={AGENCY_STATUS_TONE[a.status] || 'grey'}>{formatEnumLabel(a.status)}</Badge>
                </td>
              </tr>
            )}
          />
          <p className="mt-3 text-xs text-muted">
            {agencies.length} {agencies.length === 1 ? 'agency' : 'agencies'} shown{search ? ' matching your search' : ''}.
          </p>
        </>
      )}
    </Modal>
  );
}

// One segment's summary row — name, description, live count, criteria, and
// an "Active" availability badge (requirement 3). All four segments are
// always available — unlike Channel Settings' providers, none of these can
// be "not implemented"; resolveAudience() already handles every one.
function SegmentRow({ label, description, criteria, count, loading, onView }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-light py-3 last:border-0">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-ink">{label}</p>
          <Badge tone="green">Active</Badge>
        </div>
        <p className="mt-0.5 max-w-md text-xs text-muted">{description}</p>
        <p className="mt-0.5 text-[11px] text-muted">{criteria}</p>
      </div>
      <div className="flex flex-none items-center gap-3">
        <div className="text-right">
          <p className="text-lg font-bold text-ink">{loading ? '—' : count}</p>
          <p className="text-[10px] uppercase text-muted">{count === 1 ? 'agency' : 'agencies'}</p>
        </div>
        <Button onClick={onView} disabled={loading}>
          View Agencies
        </Button>
      </div>
    </div>
  );
}

// Audience Segments tab (Task 10) — replaces the old "Coming soon"
// placeholder. Reuses useApprovedAgencies() (above, already established by
// ComposeTab's own Audience card) for the overview: the full approved-agency
// list backs "All Agents" (its own length) and the By Tier/By Country
// groupings (grouping a plain equality column already present on every real
// returned row — not a separately invented calculation, the same server
// data just displayed two ways), and `inactiveCount` is the real, dedicated
// inactiveSinceDays=30 server request that hook already makes — "inactive"
// is real cross-table business logic (agencies.model.js#listAgencies) that
// only the backend can correctly compute, never approximated in the
// browser. Clicking "View Agencies" on any row always opens a fresh,
// dedicated, server-filtered request (SegmentDetailModal above) rather than
// re-filtering this overview's own already-fetched list — requirement 9.
function AudienceSegmentsTab() {
  const { agencies, inactiveCount, loading, error } = useApprovedAgencies();
  const [activeSegment, setActiveSegment] = useState(null);

  const tierCounts = TIERS.reduce((acc, t) => {
    acc[t] = agencies.filter((a) => a.tier === t).length;
    return acc;
  }, {});

  const countryCounts = agencies.reduce((acc, a) => {
    if (!a.country) return acc;
    acc[a.country] = (acc[a.country] || 0) + 1;
    return acc;
  }, {});
  // requirement 5 — never hard-coded, only countries that actually exist in
  // the currently-approved agency data.
  const countries = Object.keys(countryCounts).sort((a, b) => a.localeCompare(b));

  return (
    <div className="space-y-4">
      {error ? (
        <ErrorText>{error}</ErrorText>
      ) : (
        <>
          <Card label="All Agents" className="border-white">
            <SegmentRow
              label="All Agents"
              description="Every approved agency, regardless of tier, country, or recent activity."
              criteria="Approved agencies"
              count={agencies.length}
              loading={loading}
              onView={() => setActiveSegment({ type: 'all', label: 'All Agents', criteria: 'Approved agencies' })}
            />
          </Card>

          <Card label="By Tier" className="border-white">
            {TIERS.map((t) => {
              const tierLabel = `By Tier — ${t.charAt(0).toUpperCase() + t.slice(1)}`;
              return (
                <SegmentRow
                  key={t}
                  label={tierLabel}
                  description={`Approved agencies assigned the ${t} tier.`}
                  criteria={`Approved agencies · tier = ${t}`}
                  count={tierCounts[t]}
                  loading={loading}
                  onView={() =>
                    setActiveSegment({ type: 'tier', value: t, label: tierLabel, criteria: `Approved agencies · tier = ${t}` })
                  }
                />
              );
            })}
          </Card>

          <Card label="By Country" className="border-white">
            {loading ? (
              <p className="py-4 text-sm text-muted">Loading countries…</p>
            ) : countries.length === 0 ? (
              <p className="py-4 text-sm text-muted">No approved agencies have a country on file yet.</p>
            ) : (
              countries.map((c) => (
                <SegmentRow
                  key={c}
                  label={`By Country — ${c}`}
                  description={`Approved agencies based in ${c}.`}
                  criteria={`Approved agencies · country = ${c}`}
                  count={countryCounts[c]}
                  loading={loading}
                  onView={() =>
                    setActiveSegment({
                      type: 'country',
                      value: c,
                      label: `By Country — ${c}`,
                      criteria: `Approved agencies · country = ${c}`,
                    })
                  }
                />
              ))
            )}
          </Card>

          <Card label="Inactive 30+ days" className="border-white">
            <SegmentRow
              label="Inactive 30+ days"
              description={`Approved agencies with no booking, Custom FIT quote, or MICE RFQ in the last ${INACTIVE_SINCE_DAYS} days.`}
              criteria={`Approved agencies · inactive ${INACTIVE_SINCE_DAYS}+ days`}
              count={inactiveCount ?? 0}
              loading={loading}
              onView={() =>
                setActiveSegment({
                  type: 'inactive_30d',
                  label: 'Inactive 30+ days',
                  criteria: `Approved agencies · inactive ${INACTIVE_SINCE_DAYS}+ days`,
                })
              }
            />
          </Card>
        </>
      )}

      {activeSegment && <SegmentDetailModal segment={activeSegment} onClose={() => setActiveSegment(null)} />}
    </div>
  );
}

export default function Marketing() {
  const [tab, setTab] = useState('compose');

  return (
    <div className="min-h-screen bg-[#F4F7FF]">
      <div className="mx-auto max-w-6xl p-6 lg:p-10">
        <h2 className="mb-1 text-3xl font-bold">Marketing Center</h2>
        <p className="mb-5 text-sm text-muted">
          Compose and send email/WhatsApp campaigns to agencies, and review campaign history.
        </p>

        <div className="mb-6 flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-full border px-4 py-2 text-xs font-semibold ${
                tab === t.key ? 'border-ink bg-ink text-white' : 'border-line-light bg-white text-[#666]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'compose' ? (
          <ComposeTab />
        ) : tab === 'history' ? (
          <CampaignHistoryTab />
        ) : tab === 'segments' ? (
          <AudienceSegmentsTab />
        ) : (
          <ChannelSettingsTab />
        )}
      </div>
    </div>
  );
}
