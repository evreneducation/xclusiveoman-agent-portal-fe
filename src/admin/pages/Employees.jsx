import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LuEye, LuPencil, LuUserPlus } from 'react-icons/lu';
import { api } from '../api/client.js';
import { Badge, Button, Card, Checkbox, ErrorText, FieldLabel, Pagination, Table, TextInput } from '../components/ui.jsx';

// Access Features — the checkboxes that decide both what an LM/RM's /team
// sidebar shows (team/components/TeamLayout.jsx) and, for real, which
// admin.* API routes they can call (backend middleware/auth.js#requireFeature).
// Keys/labels/defaults mirror the backend's own config/accessFeatures.js by
// hand (no shared package between the two repos) — keep the two in sync if
// either ever changes.
const RM_FEATURES = [
  { key: 'approvedAgents', label: 'Approved Agents' },
  { key: 'quotesPricing', label: 'Quotes & Pricing' },
  { key: 'supportTickets', label: 'Support Tickets' },
  { key: 'bookingsDocs', label: 'Bookings & Docs' },
];
const RM_DEFAULT_PERMISSIONS = { approvedAgents: true, quotesPricing: false, supportTickets: false, bookingsDocs: false };

const LM_FEATURES = [
  { key: 'catalog', label: 'Catalog' },
  { key: 'quotesPricing', label: 'Quotes & Pricing' },
  { key: 'bookingsDocs', label: 'Bookings & Docs' },
  { key: 'fdOperations', label: 'FD Operation' },
];
const LM_DEFAULT_PERMISSIONS = { catalog: true, quotesPricing: true, bookingsDocs: false, fdOperations: false };

const PAGE_SIZE = 10;

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
    features: RM_FEATURES,
    defaultPermissions: RM_DEFAULT_PERMISSIONS,
  },
  salesManager: {
    tabLabel: 'Lead Managers',
    heading: 'Lead Managers',
    singular: 'Lead Manager',
    description: 'Create and manage the lead manager staff pool.',
    endpoint: '/admin/sales-managers',
    listResponseKey: 'salesManagers',
    showAssignedAgencies: false,
    features: LM_FEATURES,
    defaultPermissions: LM_DEFAULT_PERMISSIONS,
  },
};

const TABS = [
  { key: 'rm', label: EMPLOYEE_KINDS.rm.tabLabel },
  { key: 'salesManager', label: EMPLOYEE_KINDS.salesManager.tabLabel },
];

// Same local-Modal convention Marketing.jsx and AgentApprovals.jsx already
// use — a plain overlay, not a shared component pulled in from elsewhere.
function Modal({ title, onClose, children, footer, size = 'md' }) {
  const sizeClass = size === 'lg' ? 'max-w-2xl' : 'max-w-md';
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

function FieldTile({ label, children }) {
  return (
    <div className="rounded-md bg-panel px-3 py-2">
      <div className="text-[10px] font-semibold uppercase text-muted">{label}</div>
      <div>{children}</div>
    </div>
  );
}

// Shared by the create form and the manage panel — a titled block of
// Access Feature checkboxes for whichever `kind` is active.
function AccessFeaturesFields({ kind, permissions, onChange }) {
  return (
    <div>
      <FieldLabel>Access Features</FieldLabel>
      <div className="rounded-md border border-line-light bg-panel px-3 py-2">
        {kind.features.map(({ key, label }) => (
          <Checkbox
            key={key}
            checked={!!permissions[key]}
            onChange={(checked) => onChange({ ...permissions, [key]: checked })}
            label={label}
          />
        ))}
      </div>
    </div>
  );
}

// No password field — nothing in this app ever collects one anymore. The
// new employee signs in the same way everyone else does: email OTP, using
// the work email entered here.
function CreateEmployeeModal({ kind, onCreated, onClose }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [permissions, setPermissions] = useState(kind.defaultPermissions);
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
        permissions,
      });
      onCreated(user);
    } catch (err) {
      setError(err.message || `Unable to create ${kind.singular.toLowerCase()}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title={`Add ${kind.singular}`} onClose={onClose}>
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
        <AccessFeaturesFields kind={kind} permissions={permissions} onChange={setPermissions} />
        <ErrorText>{error}</ErrorText>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" disabled={submitting} onClick={onClose}>
            Cancel
          </Button>
          <Button variant="accent" type="submit" disabled={submitting}>
            {submitting ? 'Creating…' : `Create ${kind.singular}`}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// Read-only glance — mirrors AgentApprovals.jsx's "View Profile" vs "View
// Details" split: this is the quick view, EditEmployeeModal below is the
// full manage workflow.
function ViewEmployeeModal({ kind, employee, onClose }) {
  return (
    <Modal title={employee.fullName} onClose={onClose} footer={<Button onClick={onClose}>Close</Button>}>
      <div className="mb-4">
        <Badge tone={employee.status === 'active' ? 'green' : 'grey'}>{employee.status}</Badge>
      </div>
      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <FieldTile label="Email address">{employee.email}</FieldTile>
        <FieldTile label="Phone">{employee.phone || '—'}</FieldTile>
        <FieldTile label="WhatsApp number">{employee.whatsappNumber || '—'}</FieldTile>
        {kind.showAssignedAgencies && (
          <FieldTile label="Assigned agencies">{employee.assignedAgencies.length}</FieldTile>
        )}
      </div>
      {kind.showAssignedAgencies && (
        <div className="mt-4">
          <FieldLabel>Assigned agencies</FieldLabel>
          {employee.assignedAgencies.length === 0 ? (
            <p className="text-xs text-muted">Not yet assigned to any agency.</p>
          ) : (
            <div className="space-y-1.5">
              {employee.assignedAgencies.map((a) => (
                <div key={a.id} className="rounded-md bg-panel px-3 py-2 text-xs font-semibold">
                  {a.name}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function EditEmployeeModal({ kind, employee, onClose, onUpdated }) {
  const [fullName, setFullName] = useState(employee.fullName);
  const [phone, setPhone] = useState(employee.phone || '');
  const [whatsappNumber, setWhatsappNumber] = useState(employee.whatsappNumber || '');
  const [permissions, setPermissions] = useState({ ...kind.defaultPermissions, ...employee.permissions });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState('');

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
    <Modal title={`Edit ${employee.fullName}`} onClose={onClose} size="lg" footer={<Button onClick={onClose}>Close</Button>}>
      <div className="space-y-5">
        <Card label="Details" className="border-white shadow-none">
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

        <Card label="Access Features" className="border-white shadow-none">
          <p className="mb-3 text-xs text-muted">Decides what shows in this {kind.singular.toLowerCase()}'s /team sidebar.</p>
          <AccessFeaturesFields kind={kind} permissions={permissions} onChange={setPermissions} />
          <Button variant="accent" className="mt-3" disabled={!!submitting} onClick={() => save({ permissions }, 'permissions')}>
            {submitting === 'permissions' ? 'Saving…' : 'Save Access Features'}
          </Button>
        </Card>

        {kind.showAssignedAgencies && (
          <Card label={`Assigned agencies (${employee.assignedAgencies.length})`} className="border-white shadow-none">
            {employee.assignedAgencies.length === 0 ? (
              <p className="text-xs text-muted">Not yet assigned to any agency — assign this RM from Agent Approvals.</p>
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
    </Modal>
  );
}

// One tab's full server-paginated table — remounted (via the parent's
// key=tab) on every tab switch, so each staff type gets its own clean
// list/search/page state rather than needing to share or reset it across
// kinds.
function EmployeeTypeTab({ kind }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  // Bumped on every "a new employee was just created" event so the load
  // effect below always re-fetches once — even when search/page happen to
  // already be at their reset values ('' / 1), in which case setSearch('')/
  // setPage(1) wouldn't themselves change state and the effect wouldn't
  // otherwise re-run.
  const [reloadToken, setReloadToken] = useState(0);

  const [employees, setEmployees] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pageSize: PAGE_SIZE, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [editing, setEditing] = useState(null);

  function updateSearch(v) {
    setSearch(v);
    setPage(1);
  }

  // Pagination is fully server-side (Task: Employees table), same
  // convention as AgentApprovals.jsx — search and the page slicing itself
  // both round-trip to the API rather than being done client-side.
  async function load() {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      params.set('page', String(page));
      params.set('pageSize', String(PAGE_SIZE));

      const data = await api.get(`${kind.endpoint}?${params.toString()}`);
      setEmployees(data[kind.listResponseKey]);
      setPagination(data.pagination);
    } catch (err) {
      setError(err.message || `Unable to load ${kind.tabLabel.toLowerCase()}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, page, reloadToken]);

  function handleCreated() {
    setShowCreate(false);
    setPage(1);
    setSearch('');
    setReloadToken((t) => t + 1);
  }

  function handleUpdated(updated) {
    setEmployees((list) => list.map((e) => (e.id === updated.id ? updated : e)));
    setEditing(updated);
  }

  return (
    <div className="mx-auto max-w-6xl p-6 lg:p-10">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold">{kind.heading}</h3>
          <p className="mt-1.5 text-sm text-muted">{kind.description}</p>
        </div>
        <Button variant="accent" onClick={() => setShowCreate(true)}>
          <LuUserPlus className="mr-1.5" size={15} />
          Add {kind.singular}
        </Button>
      </div>

      <Card className="mb-5 border-white">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TextInput
            className="sm:max-w-sm"
            placeholder="Search by name, email or phone…"
            value={search}
            onChange={(e) => updateSearch(e.target.value)}
          />
          <Badge tone="grey">{pagination.total} Total {kind.tabLabel}</Badge>
        </div>
      </Card>

      <ErrorText>{error}</ErrorText>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : employees.length === 0 ? (
        <p className="rounded-lg border border-line-light bg-white p-5 text-sm text-muted shadow-sm">
          {search ? 'No one matches that search.' : `No ${kind.tabLabel.toLowerCase()} yet — click "Add ${kind.singular}" above to create one.`}
        </p>
      ) : (
        <>
          <Table
            columns={[
              'Full Name',
              'Email Address',
              'Phone',
              'WhatsApp Number',
              ...(kind.showAssignedAgencies ? ['Assigned Agencies'] : []),
              'Status',
              { label: 'Actions', align: 'right' },
            ]}
            rows={employees}
            renderRow={(e) => (
              <tr key={e.id} className="border-b border-line-light transition-colors last:border-0 hover:bg-panel/50">
                <td className="px-3 py-3 align-middle font-semibold text-ink">{e.fullName}</td>
                <td className="px-3 py-3 align-middle">{e.email}</td>
                <td className="px-3 py-3 align-middle whitespace-nowrap">{e.phone || '—'}</td>
                <td className="px-3 py-3 align-middle whitespace-nowrap">{e.whatsappNumber || '—'}</td>
                {kind.showAssignedAgencies && (
                  <td className="px-3 py-3 align-middle whitespace-nowrap">
                    {e.assignedAgencies.length} {e.assignedAgencies.length === 1 ? 'agency' : 'agencies'}
                  </td>
                )}
                <td className="px-3 py-3 align-middle">
                  <Badge tone={e.status === 'active' ? 'green' : 'grey'}>{e.status}</Badge>
                </td>
                <td className="px-3 py-3 align-middle">
                  <div className="flex flex-nowrap items-center justify-end gap-2">
                    <Button size="sm" className="whitespace-nowrap" onClick={() => setViewing(e)}>
                      <LuEye className="mr-1.5 flex-shrink-0" size={14} />
                      View
                    </Button>
                    <Button size="sm" className="whitespace-nowrap" onClick={() => setEditing(e)}>
                      <LuPencil className="mr-1.5 flex-shrink-0" size={14} />
                      Edit
                    </Button>
                  </div>
                </td>
              </tr>
            )}
          />

          <Pagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            total={pagination.total}
            pageSize={pagination.pageSize}
            onChange={setPage}
            itemLabel={kind.tabLabel.toLowerCase()}
          />
        </>
      )}

      {showCreate && <CreateEmployeeModal kind={kind} onCreated={handleCreated} onClose={() => setShowCreate(false)} />}
      {viewing && <ViewEmployeeModal kind={kind} employee={viewing} onClose={() => setViewing(null)} />}
      {editing && (
        <EditEmployeeModal kind={kind} employee={editing} onClose={() => setEditing(null)} onUpdated={handleUpdated} />
      )}
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
        <p className="mt-1.5 text-sm text-muted">Manage internal staff — Relationship Managers and Lead Managers.</p>
        <div className="mx-auto mt-5 flex max-w-6xl flex-wrap gap-2">
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
