import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { Badge, Button, Card, Checkbox, ErrorText, Select, Table, TextInput } from '../components/ui.jsx';

const MICE_HOTEL_FIELDS = [
  { key: 'name', label: 'Name', type: 'text', required: true },
  { key: 'city', label: 'City', type: 'text', required: true },
  { key: 'category', label: 'Star category', type: 'number' },
  { key: 'miceBallroomCapacity', label: 'Ballroom capacity', type: 'number' },
  { key: 'miceBreakoutRooms', label: 'Breakout rooms', type: 'number' },
  { key: 'description', label: 'Description', type: 'text' },
  { key: 'isMiceEnabled', label: 'MICE-enabled', type: 'checkbox' },
];

const ENTITY_FIELDS = {
  activities: [
    { key: 'name', label: 'Name', type: 'text', required: true },
    { key: 'city', label: 'City', type: 'text', required: true },
    { key: 'duration', label: 'Duration', type: 'text' },
    { key: 'pricePerPax', label: 'Price per pax (OMR)', type: 'number' },
    { key: 'description', label: 'Description', type: 'text' },
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
  experiences: [
    { key: 'name', label: 'Name', type: 'text', required: true },
    { key: 'description', label: 'Description', type: 'text' },
    { key: 'suitableGroupSizeMin', label: 'Min group size', type: 'number' },
    { key: 'suitableGroupSizeMax', label: 'Max group size', type: 'number' },
  ],
};

const TABS = [
  { key: 'hotels', label: 'MICE Hotels' },
  { key: 'activities', label: 'Activities' },
  { key: 'transfers', label: 'Transfers' },
  { key: 'experiences', label: 'Experiences' },
];

function AddEntityForm({ entity, fields, endpoint, onCreated, defaults = {} }) {
  const [form, setForm] = useState(defaults);
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
      const { [entity]: created } = await api.post(endpoint, payload);
      onCreated(created);
      setForm(defaults);
    } catch (err) {
      setError(err.message || 'Unable to create');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card label={`Add ${entity}`} className="mt-4 border-white">
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
                value={form[f.key] ?? ''}
                onChange={(e) => update(f.key, e.target.value)}
              />
            )}
          </div>
        ))}
        <div className="sm:col-span-2">
          <ErrorText>{error}</ErrorText>
          <Button variant="accent" type="submit" disabled={submitting} className="mt-2">
            {submitting ? 'Saving…' : `Save ${entity}`}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function MiceHotelsTab() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    api
      .get(`/admin/hotels?mice=true${search ? `&search=${encodeURIComponent(search)}` : ''}`)
      .then(({ hotels }) => setItems(hotels))
      .finally(() => setLoading(false));
  }

  useEffect(load, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleDelete(id) {
    await api.del(`/admin/hotels/${id}`);
    setItems((list) => list.filter((i) => i.id !== id));
  }

  return (
    <div>
      <TextInput className="mb-3 max-w-xs" placeholder="Search MICE hotels…" value={search} onChange={(e) => setSearch(e.target.value)} />
      {loading ? (
        <p className="text-xs text-muted">Loading…</p>
      ) : (
        <Table
          columns={['Hotel', 'City', 'Ballroom capacity', 'Breakout rooms', '']}
          rows={items}
          renderRow={(item) => (
            <tr key={item.id} className="border-b border-line-light last:border-0">
              <td className="px-3 py-2 font-semibold">{item.name}</td>
              <td className="px-3 py-2">{item.city || '—'}</td>
              <td className="px-3 py-2">{item.mice_ballroom_capacity ?? '—'}</td>
              <td className="px-3 py-2">{item.mice_breakout_rooms ?? '—'}</td>
              <td className="px-3 py-2 text-right">
                <button onClick={() => handleDelete(item.id)} className="text-[#a5162d] hover:underline">
                  Delete
                </button>
              </td>
            </tr>
          )}
        />
      )}
      {!loading && items.length === 0 && (
        <p className="mt-3 rounded-lg border border-line-light bg-panel px-3 py-3 text-xs text-muted">
          No MICE-enabled hotels yet — add one below, or enable an existing hotel for MICE from Product Catalog.
        </p>
      )}
      <AddEntityForm
        entity="hotel"
        fields={MICE_HOTEL_FIELDS}
        endpoint="/admin/hotels"
        defaults={{ isMiceEnabled: true }}
        onCreated={(created) => setItems((list) => [created, ...list])}
      />
    </div>
  );
}

function SimpleEntityTab({ entity }) {
  const fields = ENTITY_FIELDS[entity];
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

  const hasCity = entity !== 'experiences';

  return (
    <div>
      <TextInput className="mb-3 max-w-xs" placeholder={`Search ${entity}…`} value={search} onChange={(e) => setSearch(e.target.value)} />
      {loading ? (
        <p className="text-xs text-muted">Loading…</p>
      ) : (
        <Table
          columns={hasCity ? ['Name', 'City', ''] : ['Name', 'Group size', '']}
          rows={items}
          renderRow={(item) => (
            <tr key={item.id} className="border-b border-line-light last:border-0">
              <td className="px-3 py-2 font-semibold">{item.name}</td>
              <td className="px-3 py-2">
                {hasCity
                  ? item.city || '—'
                  : `${item.suitable_group_size_min ?? '—'}–${item.suitable_group_size_max ?? '—'}`}
              </td>
              <td className="px-3 py-2 text-right">
                <button onClick={() => handleDelete(item.id)} className="text-[#a5162d] hover:underline">
                  Delete
                </button>
              </td>
            </tr>
          )}
        />
      )}
      <AddEntityForm
        entity={entity.slice(0, -1)}
        fields={fields}
        endpoint={`/admin/${entity}`}
        onCreated={(created) => setItems((list) => [created, ...list])}
      />
    </div>
  );
}

export default function MiceCatalog() {
  const [tab, setTab] = useState('hotels');

  return (
    <div className="min-h-screen bg-[#eef1ef]">
      <div className="mx-auto max-w-6xl p-6 lg:p-10">
        <div className="mb-5 flex items-center gap-3">
          <h2 className="text-3xl font-bold">MICE Catalog Manager</h2>
          <Badge tone="grey">MICE-specific master data</Badge>
        </div>
        <p className="mb-6 max-w-2xl text-sm text-muted">
          Hotels here are the ones flagged MICE-enabled (with ballroom capacity &amp; breakout rooms) — they, along
          with activities, transfers, and experiences, populate the MICE Content Hub and curation screen on the
          agent side.
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

        {tab === 'hotels' ? <MiceHotelsTab /> : <SimpleEntityTab entity={tab} />}
      </div>
    </div>
  );
}
