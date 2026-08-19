import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { Badge, Button, Card, ErrorText, FieldLabel, TextInput } from '../components/ui.jsx';

// Relationship Managers and Sales Managers used to be two separate pages
// (RelationshipManagers.jsx / SalesManagers.jsx) with near-identical
// master-detail CRUD — same create form, same manage panel, same list —
// differing only in which staff endpoint they hit and whether "assigned
// agencies" applies (RM-only). Unified into one "Employees" page with a tab
// per staff type; each tab still fully manages its own type end to end via
// its own endpoint, same as the two pages did independently before.
const EMPLOYEE_KINDS = {
  rm: {
    tabLabel: 'Relationship Managers',
    heading: 'Relationship Managers',
    singular: 'Relationship Manager',
    description: "Create and manage the staff assigned as agencies' RMs.",
    endpoint: '/admin/relationship-managers',
    listResponseKey: 'relationshipManagers',
    showAssignedAgencies: true,
  },
  salesManager: {
    tabLabel: 'Sales Managers',
    heading: 'Sales Managers',
    singular: 'Sales Manager',
    description: 'Create and manage the sales manager staff pool.',
    endpoint: '/admin/sales-managers',
    listResponseKey: 'salesManagers',
    showAssignedAgencies: false,
  },
};

const TABS = [
  { key: 'rm', label: EMPLOYEE_KINDS.rm.tabLabel },
  { key: 'salesManager', label: EMPLOYEE_KINDS.salesManager.tabLabel },
];

// No password field — nothing in this app ever collects one anymore. The
// new employee signs in the same way everyone else does: email OTP, using
// the work email entered here.
function CreateEmployeeForm({ kind, onCreated, onCancel }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const { user } = await api.post(kind.endpoint, {
        fullName,
        email,
        phone: phone || undefined,
        whatsappNumber: whatsappNumber || undefined,
      });
      onCreated(user);
      setFullName('');
      setEmail('');
      setPhone('');
      setWhatsappNumber('');
    } catch (err) {
      setError(err.message || `Unable to create ${kind.singular.toLowerCase()}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card label={`Add ${kind.singular.toLowerCase()}`} className="border-white">
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3">
        <div>
          <FieldLabel>Full name</FieldLabel>
          <TextInput required value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div>
          <FieldLabel>Work email</FieldLabel>
          <TextInput type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <FieldLabel>Phone</FieldLabel>
          <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div>
          <FieldLabel>WhatsApp number</FieldLabel>
          <TextInput placeholder="+968…" value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value)} />
        </div>
        <div>
          <ErrorText>{error}</ErrorText>
          <div className="mt-2 flex gap-2">
            <Button variant="accent" type="submit" disabled={submitting} className="flex-1 justify-center">
              {submitting ? 'Creating…' : `Create ${kind.singular}`}
            </Button>
            <Button type="button" disabled={submitting} onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </div>
      </form>
    </Card>
  );
}

function ManageEmployeePanel({ kind, employee, onUpdated }) {
  const [fullName, setFullName] = useState(employee.fullName);
  const [phone, setPhone] = useState(employee.phone || '');
  const [whatsappNumber, setWhatsappNumber] = useState(employee.whatsappNumber || '');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState('');

  useEffect(() => {
    setFullName(employee.fullName);
    setPhone(employee.phone || '');
    setWhatsappNumber(employee.whatsappNumber || '');
    setError('');
  }, [employee.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save(fields, key) {
    setError('');
    setSubmitting(key);
    try {
      const { user } = await api.patch(`${kind.endpoint}/${employee.id}`, fields);
      onUpdated({ ...employee, ...user });
    } catch (err) {
      setError(err.message || `Unable to update ${kind.singular.toLowerCase()}`);
    } finally {
      setSubmitting('');
    }
  }

  return (
    <div className="space-y-5">
      <Card label={`Manage ${kind.singular.toLowerCase()}`} className="border-white">
        <div className="space-y-4 text-sm">
          <div>
            <FieldLabel>Full name</FieldLabel>
            <TextInput value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div>
            <FieldLabel>Phone</FieldLabel>
            <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <FieldLabel>WhatsApp number</FieldLabel>
            <TextInput value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value)} />
          </div>

          <ErrorText>{error}</ErrorText>

          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              variant="accent"
              disabled={!!submitting}
              onClick={() => save({ fullName, phone, whatsappNumber }, 'details')}
            >
              {submitting === 'details' ? 'Saving…' : 'Save Changes'}
            </Button>
            {employee.status === 'active' ? (
              <Button variant="danger" disabled={!!submitting} onClick={() => save({ status: 'disabled' }, 'status')}>
                {submitting === 'status' ? 'Disabling…' : 'Disable Account'}
              </Button>
            ) : (
              <Button disabled={!!submitting} onClick={() => save({ status: 'active' }, 'status')}>
                {submitting === 'status' ? 'Enabling…' : 'Re-enable Account'}
              </Button>
            )}
          </div>
        </div>
      </Card>

      {kind.showAssignedAgencies && (
        <Card label={`Assigned agencies (${employee.assignedAgencies.length})`} className="border-white">
          {employee.assignedAgencies.length === 0 ? (
            <p className="text-xs text-muted">
              Not yet assigned to any agency — assign this RM from Agent Approvals.
            </p>
          ) : (
            <div className="space-y-1.5">
              {employee.assignedAgencies.map((a) => (
                <div key={a.id} className="rounded-md bg-panel px-3 py-2 text-xs font-semibold">
                  {a.name}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

// One tab's full master-detail CRUD — remounted (via the parent's key=tab)
// on every tab switch, so each staff type gets its own clean list/selection/
// loading state rather than needing to share or reset state across kinds.
function EmployeeTypeTab({ kind }) {
  const [employees, setEmployees] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Create form is now its own toggled panel (a dedicated "+ Add" button)
  // rather than always sitting rendered below the list.
  const [showCreateForm, setShowCreateForm] = useState(false);

  function load() {
    setLoading(true);
    setError('');
    api
      .get(kind.endpoint)
      .then((data) => {
        const list = data[kind.listResponseKey];
        setEmployees(list);
        setSelectedId((current) => (list.some((e) => e.id === current) ? current : list[0]?.id || null));
      })
      .catch((err) => setError(err.message || `Unable to load ${kind.tabLabel.toLowerCase()}`))
      .finally(() => setLoading(false));
  }

  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selected = useMemo(() => employees.find((e) => e.id === selectedId) || null, [employees, selectedId]);

  function handleCreated(user) {
    setEmployees((list) => [kind.showAssignedAgencies ? { ...user, assignedAgencies: [] } : user, ...list]);
    setSelectedId(user.id);
    setShowCreateForm(false);
  }

  function handleUpdated(updated) {
    setEmployees((list) => list.map((e) => (e.id === updated.id ? updated : e)));
  }

  return (
    <div className="flex flex-col lg:flex-row">
      <div className="w-full flex-none border-b border-line-light bg-white/90 p-6 lg:min-h-[calc(100vh-9rem)] lg:w-[26rem] lg:border-b-0 lg:border-r">
        <div className="mb-6 flex items-end justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold">{kind.heading}</h3>
            <p className="mt-1.5 text-sm text-muted">{kind.description}</p>
          </div>
          <Badge tone="grey">{employees.length}</Badge>
        </div>

        <Button
          variant="accent"
          className="mb-5 w-full justify-center"
          onClick={() => setShowCreateForm((v) => !v)}
        >
          {showCreateForm ? 'Close' : `+ Add ${kind.singular}`}
        </Button>

        {showCreateForm && (
          <div className="mb-5">
            <CreateEmployeeForm kind={kind} onCreated={handleCreated} onCancel={() => setShowCreateForm(false)} />
          </div>
        )}

        {loading && <p className="rounded-lg border border-line-light bg-panel px-3 py-2 text-xs text-muted">Loading…</p>}
        <ErrorText>{error}</ErrorText>
        {!loading && employees.length === 0 && !showCreateForm && (
          <p className="rounded-lg border border-line-light bg-panel px-3 py-3 text-xs text-muted">
            No {kind.tabLabel.toLowerCase()} yet — click "+ Add {kind.singular}" above to create one.
          </p>
        )}

        <div className="space-y-3">
          {employees.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => setSelectedId(e.id)}
              className={`block w-full rounded-lg border p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                e.id === selectedId ? 'border-accent bg-[#fff8f4]' : 'border-line-light bg-white'
              }`}
            >
              <div className="text-sm font-bold">{e.fullName}</div>
              <div className="mt-1 text-xs text-muted">{e.email}</div>
              <div className="mt-2 flex items-center gap-2">
                <Badge tone={e.status === 'active' ? 'green' : 'grey'}>{e.status}</Badge>
                {kind.showAssignedAgencies && (
                  <span className="text-[10px] text-muted">
                    {e.assignedAgencies.length} {e.assignedAgencies.length === 1 ? 'agency' : 'agencies'}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 p-6 lg:p-10">
        {!selected && (
          <p className="rounded-lg border border-line-light bg-white p-5 text-sm text-muted">
            Select a {kind.singular.toLowerCase()} from the list, or add a new one.
          </p>
        )}
        {selected && (
          <div className="max-w-2xl">
            <h3 className="mb-4 text-2xl font-bold">{selected.fullName}</h3>
            <ManageEmployeePanel kind={kind} employee={selected} onUpdated={handleUpdated} />
          </div>
        )}
      </div>
    </div>
  );
}

export default function Employees() {
  // URL-driven (?tab=rm|salesManager) rather than plain useState — lets
  // Dashboard.jsx's two separate "Relationship Managers"/"Sales Managers"
  // quick links each deep-link straight to their tab instead of always
  // landing on whichever tab happens to be first.
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const tab = tabParam && EMPLOYEE_KINDS[tabParam] ? tabParam : 'rm';

  function setTab(next) {
    setSearchParams({ tab: next });
  }

  return (
    <div className="min-h-screen bg-[#F4F7FF]">
      <div className="border-b border-line-light bg-white/90 px-6 pt-6 lg:px-10">
        <h2 className="text-2xl font-bold">Employees & Roles</h2>
        <p className="mt-1.5 text-sm text-muted">Manage internal staff — Relationship Managers and Sales Managers.</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-t-lg border border-b-0 px-4 py-2.5 text-xs font-semibold ${
                tab === t.key ? 'border-line-light bg-[#F4F7FF] text-ink' : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <EmployeeTypeTab key={tab} kind={EMPLOYEE_KINDS[tab]} />
    </div>
  );
}
