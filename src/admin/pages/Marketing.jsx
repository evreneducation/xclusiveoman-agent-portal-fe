import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../../shared/components/ToastProvider.jsx';
import { Badge, Button, Card, Checkbox, ErrorText, FieldLabel, Select, Tag, Textarea, TextInput } from '../components/ui.jsx';

// PRD screen 17 (Marketing Center). Task 5 makes Send Test and Send
// Campaign real (POST /admin/marketing/send-test, POST
// /admin/marketing/campaigns — backend added this task). Campaign History,
// Audience Segments management, and Channel Settings are still placeholders
// — those are separate, later tasks.
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

// No backend endpoint exists yet to ask "is this provider actually
// connected" (Channel Settings, a separate later task, will own that). Every
// provider is hard-coded to "configuration required" rather than faking a
// "Connected" status nothing has verified — Send Test/Send Campaign below
// are the actual source of truth for whether a send can go out.
const CONNECTION_STATUS_META = {
  connected: { label: 'Connected', tone: 'green' },
  not_connected: { label: 'Not connected', tone: 'grey' },
  configuration_required: { label: 'Configuration required', tone: 'amber' },
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
function Modal({ title, onClose, children, footer }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-lg border border-line-light bg-white p-5 shadow-lg sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h3 className="text-lg font-bold text-ink">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="text-lg leading-none text-muted hover:text-ink">
            ×
          </button>
        </div>
        <div>{children}</div>
        {footer && <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-line-light pt-4">{footer}</div>}
      </div>
    </div>
  );
}

// Channel + Provider — picking the channel narrows the provider list to
// that channel's options (Email: Mailchimp/Zoho Campaigns/Built-in sender;
// WhatsApp: WhatsApp Business API only), and the selected provider's
// connection status is shown underneath.
function ChannelSection({ channel, onChannelChange, provider, onProviderChange }) {
  const providers = PROVIDER_OPTIONS[channel] || [];
  // Every provider is "configuration required" today — see
  // CONNECTION_STATUS_META's comment above for why this isn't a real check.
  const statusMeta = CONNECTION_STATUS_META.configuration_required;

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
        <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
        <span className="text-xs text-muted">
          No live connection check exists yet — this provider needs to be configured (in a later Channel Settings
          task) before it can send anything.
        </span>
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

      <ChannelSection channel={channel} onChannelChange={handleChannelChange} provider={provider} onProviderChange={setProvider} />

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

export default function Marketing() {
  const [tab, setTab] = useState('compose');

  return (
    <div className="min-h-screen bg-[#eef1f7]">
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
          <EmptyTabState description="Sent and scheduled campaigns will appear here once Campaign History is built." />
        ) : tab === 'segments' ? (
          <EmptyTabState description="Build agency/agent audience segments here once this is connected to live data." />
        ) : (
          <EmptyTabState description="Mailchimp, Zoho, and WhatsApp channel connections will be configured here." />
        )}
      </div>
    </div>
  );
}
