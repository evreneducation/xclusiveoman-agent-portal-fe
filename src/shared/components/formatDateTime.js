// Shared date-time formatter — renders an ISO timestamp as
// "27 Aug 2026, 6:00 PM": date first, then 12-hour time, in IST
// (Asia/Kolkata), the timezone the ops team works in regardless of where the
// admin's own browser is. Used for the Created / Updated columns across the
// admin Product Catalog tables (src/admin/pages/ProductCatalog.jsx).
//
// Built from Intl.DateTimeFormat parts rather than a single toLocaleString()
// call so the output is byte-for-byte the same on every browser/Node ICU
// build — locale defaults disagree on the separator, on "Aug" vs "Aug.", and
// on "pm" vs "PM". Returns "—" for a missing or unparseable value so a table
// cell never shows "Invalid Date".
export function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(date);

  const pick = (type) => parts.find((p) => p.type === type)?.value ?? '';
  const dayPeriod = pick('dayPeriod').toUpperCase().replace(/\./g, '');
  return `${pick('day')} ${pick('month')} ${pick('year')}, ${pick('hour')}:${pick('minute')} ${dayPeriod}`;
}
