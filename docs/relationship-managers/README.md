# Relationship Managers admin tab

New sidebar tab in the admin console — "Relationship Managers" — for creating
and managing the staff who get assigned as an agency's dedicated Relationship
Manager (doc §4 persona table, §8.8 REL-1/REL-2). Previously `agencies.rm_user_id`
could point at *any* staff user, but there was no way to create or manage the
RM pool itself as a distinct group — Agent Approvals just had a raw dropdown
of `/admin/team` staff.

## What changed

### Backend — `xclusiveoman-agent-portal-be`

- **`migrations/0009_relationship_manager_role.sql`** — adds
  `'relationship_manager'` to the `user_role` enum (verified by running
  `npm run migrate` against the local dev DB — applied cleanly).
- **`src/middleware/auth.js`** — added `'relationship_manager'` to
  `STAFF_ROLES`, so RMs can log into the admin console like any other staff
  member.
- **`src/validation/schemas.js`** — `createRelationshipManagerSchema` (name,
  email, password, phone, whatsapp) and `patchRelationshipManagerSchema`
  (name/phone/whatsapp/status — deliberately excludes `role`, so this
  endpoint can never be used to escalate a user to `super_admin` etc.).
- **`src/models/users.model.js`** — added `listStaffByRole(role)`.
- **`src/models/agencies.model.js`** — added `listAgenciesByRmIds(ids)`, a
  single query used to annotate each RM with the agencies currently pointing
  at them via `agencies.rm_user_id`, instead of a separate join table.
- **New** `src/controllers/relationshipManagers.controller.js` +
  `src/routes/relationshipManagers.routes.js`, mounted at
  `/api/admin/relationship-managers` (`src/routes/index.js`):
  - `GET /admin/relationship-managers` — list, each row includes
    `assignedAgencies: [{id, name}]`
  - `POST /admin/relationship-managers` — creates a user with `role` fixed
    server-side to `relationship_manager` (mirrors the existing
    `POST /admin/team` pattern in `admin.controller.js`)
  - `PATCH /admin/relationship-managers/:id` — update details / disable /
    re-enable
  - All three gated `requireAuth, requireRole('super_admin')`, same as the
    existing `/admin/team` endpoints.

Reassigning *which* agency an RM manages still goes through the existing
`PATCH /admin/agencies/:id` (`rmUserId` field) from the Agent Approvals
screen — that logic (validating the target is internal staff) already
existed and needed no changes.

### Frontend — `xclusiveoman-agent-portal-fe/admin`

- **New page** `src/pages/RelationshipManagers.jsx` — master/detail layout
  (mirrors `AgentApprovals.jsx`'s pattern): left list of RMs with status +
  assigned-agency count, an "Add relationship manager" form beneath it, and
  a right-hand detail panel to edit the selected RM's name/phone/WhatsApp,
  disable/re-enable their account, and view their assigned agencies
  (read-only — reassignment stays on Agent Approvals).
- `src/components/icons.jsx` — added `RelationshipManagerIcon`.
- `src/components/AdminLayout.jsx` — added the "Relationship Managers" nav
  item (between Agent Approvals and Product Catalog).
- `src/App.jsx` — added the `/relationship-managers` route.

## Verified

- Backend: `node --check` on every touched/new file; `npm run migrate`
  applied `0009_relationship_manager_role.sql` cleanly against the running
  local Postgres.
- End-to-end against the live local backend (`admin@xclusiveoman.com` dev
  super admin): logged in, `POST /admin/relationship-managers` created a
  real RM, `GET` listed it, `PATCH` disabled/re-enabled it, then assigned it
  to a real agency via the existing `/admin/agencies/:id` endpoint and
  confirmed it showed up in `assignedAgencies` — then reverted that
  assignment and left the disabled test RM in place (nothing in this app
  hard-deletes staff; disabling is the existing convention).
- Frontend: `npm run build` + `oxlint` clean.

## Deliberately out of scope

- No UI to reassign an agency's RM from this new screen — that already
  exists on Agent Approvals and duplicating it wasn't necessary for "create
  and manage relationship managers."
- No bulk import, no email invite flow (the super admin sets a temporary
  password directly, same as `/admin/team` today).
