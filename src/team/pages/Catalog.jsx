import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LuLayoutGrid, LuSearchX } from 'react-icons/lu';
import { api } from '../api/client.js';
import { Badge, Card, EmptyState, ErrorText, LoadingState, PageHeader, TextInput } from '../components/ui.jsx';

// Catalog browse — read-only. Editing the Product Catalog stays an
// ops_admin+/content job in the full Admin Console; the Team Portal's
// Catalog Access Feature is about a Lead Manager being able to see what's
// currently sellable while working a quote, not managing it.
const TABS = [
  { key: 'hotels', label: 'Hotels', endpoint: '/hotels', listKey: 'hotels' },
  { key: 'tours', label: 'Tours', endpoint: '/tours', listKey: 'tours' },
  { key: 'activities', label: 'Activities', endpoint: '/activities', listKey: 'activities' },
  { key: 'transfers', label: 'Transfers', endpoint: '/transfers', listKey: 'transfers' },
  { key: 'fdPackages', label: 'FD Packages', endpoint: '/admin/fd-packages', listKey: 'fdPackages' },
];

function CatalogGrid({ tab }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    api
      .get(tab.endpoint)
      .then((data) => setItems(data[tab.listKey] || []))
      .catch((err) => setError(err.message || 'Unable to load'))
      .finally(() => setLoading(false));
  }, [tab.endpoint, tab.listKey]);

  const filtered = items.filter((it) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (it.name || it.title || '').toLowerCase().includes(q) || (it.city || '').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      <TextInput placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
      <ErrorText>{error}</ErrorText>
      {loading && <LoadingState />}
      {!loading && filtered.length === 0 && !error && <EmptyState icon={LuSearchX}>Nothing here yet.</EmptyState>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((it) => (
          <Card key={it.id}>
            <div className="flex items-start justify-between gap-2">
              <div className="text-sm font-bold text-team-ink">{it.name || it.title}</div>
              {it.status && <Badge tone={it.status === 'published' ? 'green' : 'grey'}>{it.status}</Badge>}
            </div>
            <p className="mt-1.5 text-xs text-team-muted">
              {[it.city, it.category, it.type, it.theme].filter(Boolean).join(' · ')}
            </p>
            {(it.price != null || it.pricePerPax != null || it.pricePerNight != null) && (
              <p className="mt-2 text-sm font-semibold text-team-accent-dark">
                {it.price ?? it.pricePerPax ?? it.pricePerNight}
              </p>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function Catalog() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const tab = TABS.find((t) => t.key === tabParam) || TABS[0];

  return (
    <div className="mx-auto max-w-6xl p-6 lg:p-10">
      <PageHeader icon={LuLayoutGrid} title="Catalog" subtitle="Browse the live Product & MICE catalog." />

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setSearchParams({ tab: t.key })}
            className={`rounded-t-lg border border-b-0 px-4 py-2.5 text-xs font-semibold transition-colors ${
              tab.key === t.key
                ? 'border-team-line-light bg-team-panel text-team-accent-dark'
                : 'border-transparent text-team-muted hover:text-team-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="rounded-b-lg rounded-tr-lg border border-team-line-light bg-team-panel p-5">
        <CatalogGrid key={tab.key} tab={tab} />
      </div>
    </div>
  );
}
