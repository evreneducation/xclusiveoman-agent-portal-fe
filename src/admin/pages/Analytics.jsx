import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { Badge, Button, Card, Select, Table, TextInput } from '../components/ui.jsx';
import { formatCurrency } from '../../shared/fdPackage/index.js';

// Admin Analytics & Reporting (Task 19 — Screen 18, ANL-1). Every number on
// this page comes straight from a server-side PostgreSQL aggregation
// (analytics.model.js) — nothing here is computed or reconstructed
// client-side. No charting library was added: the revenue-by-month
// visualization below is a plain CSS bar chart (a row of divs with
// percentage heights), which is enough for one series over ≤12 months and
// avoids pulling in a dependency for a single chart.

const TIER_OPTIONS = [
  { value: '', label: 'All tiers' },
  { value: 'gold', label: 'Gold' },
  { value: 'silver', label: 'Silver' },
  { value: 'bronze', label: 'Bronze' },
];

const CREATED_VIA_LABEL = { self_service: 'Self-service', manual_admin: 'Manual (admin)' };

function StatCard({ label, value, loading, sub }) {
  return (
    <Card className="border-white">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-2 text-3xl font-bold text-ink">{loading ? '—' : value}</div>
      {!loading && sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
    </Card>
  );
}

function ProfitMarginCard({ profitMargin, loading }) {
  return (
    <Card className="border-white">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">Profit Margin</div>
      <div className="mt-2 text-3xl font-bold text-muted">{loading ? '—' : 'N/A'}</div>
      {!loading && profitMargin && !profitMargin.available && (
        <div className="mt-1 text-[11px] leading-snug text-muted">{profitMargin.reason}</div>
      )}
    </Card>
  );
}

function RevenueByMonthChart({ months, loading }) {
  if (loading) return <p className="text-sm text-muted">Loading…</p>;
  if (months.length === 0) return <p className="text-sm text-muted">No data for this range.</p>;

  const max = Math.max(1, ...months.map((m) => m.revenue));

  return (
    <div className="flex h-56 items-end gap-1.5 overflow-x-auto pb-1">
      {months.map((m) => {
        const heightPct = Math.max(2, Math.round((m.revenue / max) * 100));
        const label = new Date(m.month).toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
        return (
          <div key={m.month} className="flex h-full min-w-[30px] flex-1 flex-col items-center justify-end gap-1">
            <div className="text-[9px] font-semibold leading-tight text-ink">{m.revenue > 0 ? formatCurrency(m.revenue) : ''}</div>
            <div
              className="w-full rounded-t-md bg-accent transition-all"
              style={{ height: `${heightPct}%`, minHeight: 2 }}
              title={`${label}: ${formatCurrency(m.revenue)} · ${m.bookingCount} booking(s)`}
            />
            <div className="text-[9px] leading-tight text-muted">{label}</div>
          </div>
        );
      })}
    </div>
  );
}

function SalesMixBreakdown({ salesMix, loading }) {
  if (loading) return <p className="text-sm text-muted">Loading…</p>;
  if (salesMix.length === 0) return <p className="text-sm text-muted">No bookings in this range.</p>;

  const totalRevenue = salesMix.reduce((sum, m) => sum + m.revenue, 0) || 1;

  return (
    <div className="space-y-3">
      {salesMix.map((m) => {
        const pct = Math.round((m.revenue / totalRevenue) * 100);
        return (
          <div key={m.createdVia}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-semibold text-ink">{CREATED_VIA_LABEL[m.createdVia] || m.createdVia}</span>
              <span className="text-muted">
                {m.bookingCount} booking(s) · {formatCurrency(m.revenue)}
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-panel">
              <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Analytics() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [tier, setTier] = useState('');
  const [country, setCountry] = useState('');

  const [summary, setSummaryData] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [months, setMonths] = useState([]);
  const [monthsLoading, setMonthsLoading] = useState(true);
  const [agencies, setAgencies] = useState([]);
  const [agenciesPagination, setAgenciesPagination] = useState({ total: 0, page: 1, pageSize: 10, totalPages: 1 });
  const [agenciesLoading, setAgenciesLoading] = useState(true);
  const [agenciesPage, setAgenciesPage] = useState(1);
  const [error, setError] = useState('');

  function buildParams(extra = {}) {
    const params = new URLSearchParams();
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    if (tier) params.set('tier', tier);
    if (country) params.set('country', country);
    Object.entries(extra).forEach(([k, v]) => params.set(k, v));
    return params.toString();
  }

  function loadAll() {
    setError('');
    setSummaryLoading(true);
    api
      .get(`/admin/analytics/summary?${buildParams()}`)
      .then(setSummaryData)
      .catch((err) => setError(err.message || 'Unable to load analytics summary'))
      .finally(() => setSummaryLoading(false));

    setMonthsLoading(true);
    api
      .get(`/admin/analytics/revenue-by-month?${buildParams()}`)
      .then(({ months: m }) => setMonths(m))
      .catch(() => {})
      .finally(() => setMonthsLoading(false));

    setAgenciesLoading(true);
    api
      .get(`/admin/analytics/top-agencies?${buildParams({ page: agenciesPage })}`)
      .then(({ agencies: a, pagination: p }) => {
        setAgencies(a);
        setAgenciesPagination(p);
      })
      .catch(() => {})
      .finally(() => setAgenciesLoading(false));
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo, tier, country, agenciesPage]);

  function updateFilter(setter) {
    return (v) => {
      setter(v);
      setAgenciesPage(1);
    };
  }

  return (
    <div className="min-h-screen bg-[#F4F7FF]">
      <div className="mx-auto max-w-6xl p-6 lg:p-10">
        <h2 className="mb-1 text-3xl font-bold">Sales, Revenue & Profit</h2>
        <p className="mb-5 text-sm text-muted">Sales, revenue, and agency performance — server-aggregated from real booking data.</p>

        <Card className="mb-5 border-white">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <TextInput type="date" value={dateFrom} onChange={(e) => updateFilter(setDateFrom)(e.target.value)} />
              <p className="mt-1 text-[10px] text-muted">From</p>
            </div>
            <div>
              <TextInput type="date" value={dateTo} onChange={(e) => updateFilter(setDateTo)(e.target.value)} />
              <p className="mt-1 text-[10px] text-muted">To</p>
            </div>
            <Select value={tier} onChange={(e) => updateFilter(setTier)(e.target.value)}>
              {TIER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
            <TextInput placeholder="Filter by country…" value={country} onChange={(e) => updateFilter(setCountry)(e.target.value)} />
          </div>
        </Card>

        {error && <p className="mb-4 text-sm text-[#a5162d]">{error}</p>}

        <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard label="Total Bookings" value={summary?.totalBookings} loading={summaryLoading} />
          <StatCard label="Total Revenue" value={summary && formatCurrency(summary.totalRevenue)} loading={summaryLoading} />
          <StatCard
            label="Avg. Booking Value"
            value={summary && formatCurrency(summary.averageBookingValue)}
            loading={summaryLoading}
          />
          <StatCard label="Total Agencies" value={summary?.totalAgencies} loading={summaryLoading} />
          <ProfitMarginCard profitMargin={summary?.profitMargin} loading={summaryLoading} />
        </div>

        <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Card label="Revenue by Month" className="border-white">
            <RevenueByMonthChart months={months} loading={monthsLoading} />
          </Card>
          <Card label="Sales Mix (by channel)" className="border-white">
            <SalesMixBreakdown salesMix={summary?.salesMix || []} loading={summaryLoading} />
          </Card>
        </div>

        <Card label="Top Agencies" className="border-white">
          {agenciesLoading ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : agencies.length === 0 ? (
            <p className="text-sm text-muted">No agencies match these filters.</p>
          ) : (
            <>
              <Table
                columns={['Agency', 'Tier', 'Country', 'Bookings', 'Revenue']}
                rows={agencies}
                renderRow={(a) => (
                  <tr key={a.agencyId} className="border-b border-line-light last:border-0">
                    <td className="px-3 py-2 font-semibold">{a.agencyName}</td>
                    <td className="px-3 py-2">{a.tier ? <Badge tone="grey">{a.tier}</Badge> : '—'}</td>
                    <td className="px-3 py-2">{a.country || '—'}</td>
                    <td className="px-3 py-2">{a.bookingCount}</td>
                    <td className="px-3 py-2 font-semibold">{formatCurrency(a.revenue)}</td>
                  </tr>
                )}
              />
              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-muted">
                  Page {agenciesPagination.page} of {agenciesPagination.totalPages} · {agenciesPagination.total} total
                </span>
                <div className="flex gap-2">
                  <Button disabled={agenciesPagination.page <= 1} onClick={() => setAgenciesPage((p) => Math.max(1, p - 1))}>
                    Previous
                  </Button>
                  <Button
                    disabled={agenciesPagination.page >= agenciesPagination.totalPages}
                    onClick={() => setAgenciesPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
