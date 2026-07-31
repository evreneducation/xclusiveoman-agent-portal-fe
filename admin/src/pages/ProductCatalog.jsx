import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Badge, Button, Card, Checkbox, ErrorText, Select, Table, TextInput } from '../components/ui.jsx';

const ENTITY_FIELDS = {
  hotels: [
    { key: 'name', label: 'Name', type: 'text', required: true },
    { key: 'city', label: 'City', type: 'text', required: true },
    { key: 'category', label: 'Star category', type: 'number' },
    { key: 'description', label: 'Description', type: 'text' },
    { key: 'isMiceEnabled', label: 'MICE-enabled', type: 'checkbox' },
  ],
  tours: [
    { key: 'name', label: 'Name', type: 'text', required: true },
    { key: 'city', label: 'City', type: 'text', required: true },
    { key: 'duration', label: 'Duration', type: 'text' },
    { key: 'description', label: 'Description', type: 'text' },
    { key: 'suitableAgeMin', label: 'Suitable age (min)', type: 'number' },
    { key: 'isBestseller', label: 'Bestseller', type: 'checkbox' },
  ],
  activities: [
    { key: 'name', label: 'Name', type: 'text', required: true },
    { key: 'city', label: 'City', type: 'text', required: true },
    { key: 'duration', label: 'Duration', type: 'text' },
    { key: 'pricePerPax', label: 'Price per pax (OMR)', type: 'number' },
    { key: 'description', label: 'Description', type: 'text' },
    { key: 'isBestseller', label: 'Bestseller', type: 'checkbox' },
  ],
  transfers: [
    { key: 'name', label: 'Name', type: 'text', required: true },
    {
      key: 'type',
      label: 'Type',
      type: 'select',
      options: ['airport', 'intercity', 'point_to_point', 'group_coach'],
      required: true,
    },
    { key: 'vehicleClass', label: 'Vehicle class', type: 'text' },
    { key: 'city', label: 'City', type: 'text' },
    { key: 'description', label: 'Description', type: 'text' },
  ],
};

const TABS = [
  { key: 'fdPackages', label: 'FD Packages' },
  { key: 'hotels', label: 'Hotels' },
  { key: 'tours', label: 'Tours' },
  { key: 'activities', label: 'Activities' },
  { key: 'transfers', label: 'Transfers' },
];

const STATUS_TONE = { published: 'green', draft: 'grey', closed: 'red' };

function FdPackagesTab() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/admin/fd-packages')
      .then(({ fdPackages }) => setItems(fdPackages))
      .finally(() => setLoading(false));
  }, []);

  const filtered = items.filter((i) => i.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <TextInput className="max-w-xs" placeholder="Search FD packages…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Link to="/catalog/fd-packages/new">
          <Button variant="accent">+ Add New FD Package</Button>
        </Link>
      </div>
      {loading ? (
        <p className="text-xs text-muted">Loading…</p>
      ) : (
        <Table
          columns={['Package', 'Theme', 'Duration', 'Status', '']}
          rows={filtered}
          renderRow={(pkg) => (
            <tr key={pkg.id} className="border-b border-line-light last:border-0">
              <td className="px-3 py-2 font-semibold">{pkg.title}</td>
              <td className="px-3 py-2">{pkg.theme || '—'}</td>
              <td className="px-3 py-2">{pkg.duration || '—'}</td>
              <td className="px-3 py-2">
                <Badge tone={STATUS_TONE[pkg.status] || 'grey'}>{pkg.status}</Badge>
              </td>
              <td className="px-3 py-2 text-right">
                <Link to={`/catalog/fd-packages/${pkg.id}`} className="text-accent hover:underline">
                  Edit
                </Link>
              </td>
            </tr>
          )}
        />
      )}
    </div>
  );
}

function AddEntityForm({ entity, onCreated }) {
  const fields = ENTITY_FIELDS[entity];
  const [form, setForm] = useState({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const payload = {};
      for (const f of fields) {
        if (form[f.key] === undefined) continue;
        payload[f.key] = f.type === 'number' ? Number(form[f.key]) : form[f.key];
      }
      const { [entity.slice(0, -1)]: created } = await api.post(`/admin/${entity}`, payload);
      onCreated(created);
      setForm({});
    } catch (err) {
      setError(err.message || 'Unable to create');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card label={`Add ${entity.slice(0, -1)}`} className="mt-4 border-white">
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {fields.map((f) => (
          <div key={f.key}>
            <div className="mb-1 text-xs text-muted">{f.label}</div>
            {f.type === 'checkbox' ? (
              <Checkbox checked={!!form[f.key]} onChange={(v) => update(f.key, v)} label={f.label} />
            ) : f.type === 'select' ? (
              <Select value={form[f.key] || ''} onChange={(e) => update(f.key, e.target.value)}>
                <option value="">Select…</option>
                {f.options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </Select>
            ) : (
              <TextInput
                type={f.type === 'number' ? 'number' : 'text'}
                required={f.required}
                value={form[f.key] || ''}
                onChange={(e) => update(f.key, e.target.value)}
              />
            )}
          </div>
        ))}
        <div className="sm:col-span-2">
          <ErrorText>{error}</ErrorText>
          <Button variant="accent" type="submit" disabled={submitting} className="mt-2">
            {submitting ? 'Saving…' : `Save ${entity.slice(0, -1)}`}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function SimpleEntityTab({ entity }) {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    api
      .get(`/${entity}${search ? `?search=${encodeURIComponent(search)}` : ''}`)
      .then((data) => setItems(data[entity]))
      .finally(() => setLoading(false));
  }

  useEffect(load, [entity, search]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleDelete(id) {
    await api.del(`/admin/${entity}/${id}`);
    setItems((list) => list.filter((i) => i.id !== id));
  }

  return (
    <div>
      <TextInput className="mb-3 max-w-xs" placeholder={`Search ${entity}…`} value={search} onChange={(e) => setSearch(e.target.value)} />
      {loading ? (
        <p className="text-xs text-muted">Loading…</p>
      ) : (
        <Table
          columns={['Name', 'City', '']}
          rows={items}
          renderRow={(item) => (
            <tr key={item.id} className="border-b border-line-light last:border-0">
              <td className="px-3 py-2 font-semibold">{item.name}</td>
              <td className="px-3 py-2">{item.city || '—'}</td>
              <td className="px-3 py-2 text-right">
                <button onClick={() => handleDelete(item.id)} className="text-[#a5162d] hover:underline">
                  Delete
                </button>
              </td>
            </tr>
          )}
        />
      )}
      <AddEntityForm entity={entity} onCreated={(created) => setItems((list) => [created, ...list])} />
    </div>
  );
}

export default function ProductCatalog() {
  const { user, logout, socketConnected } = useAuth();
  const [tab, setTab] = useState('fdPackages');

  return (
    <div className="min-h-screen bg-[#eef1ef]">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line-light bg-white/95 px-5 py-3 shadow-sm backdrop-blur">
        <div>
          <div className="text-sm font-bold text-ink">Xclusive Oman Admin</div>
          <div className="text-[11px] text-muted">Product catalog</div>
        </div>
        <div className="flex items-center justify-end gap-3 text-xs">
          <Link to="/approvals" className="hidden font-semibold text-ink hover:underline sm:inline">
            Agent Approvals
          </Link>
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full border border-line-light bg-panel"
            title={socketConnected ? 'Live connection active' : 'Connecting…'}
          >
            <span className={`h-2.5 w-2.5 rounded-full ${socketConnected ? 'bg-[#2f7d32] shadow-[0_0_0_4px_rgba(47,125,50,0.12)]' : 'bg-[#ccc]'}`} />
          </div>
          <span className="hidden sm:inline">
            {user?.fullName} <span className="text-muted">({user?.role})</span>
          </span>
          <Button onClick={logout}>Log out</Button>
        </div>
      </div>

      <div className="mx-auto max-w-6xl p-5 lg:p-8">
        <h2 className="mb-4 text-2xl font-bold">Product Catalog</h2>
        <div className="mb-5 flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                tab === t.key ? 'border-ink bg-ink text-white' : 'border-line-light bg-white text-[#666]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'fdPackages' ? <FdPackagesTab /> : <SimpleEntityTab entity={tab} />}
      </div>
    </div>
  );
}
