# MICE Catalog Manager (admin screen 35)

Implements Wireframe Screen 35 / spec item **MICE-15 / CAT-3** ("MICE catalog
management") from `Xclusive-Oman-Master-Documentation.pdf` — a dedicated admin
screen for the MICE-specific master data that feeds the (not-yet-built) MICE
Content Hub and curation screen on the agent side.

This was one item picked off a larger remaining-work list (quotes/pricing,
marketing, analytics, operations, MICE catalog, "Request More Info", 2FA) and
implemented end to end, backend + admin frontend, without touching the others.

## Why this one

The backend's generic catalog CRUD factory (`catalog.model.js` /
`catalog.controller.js` / `catalog.routes.js`) already covered `hotels`,
`tours`, `activities`, `transfers`, and `experiences`, and `hotels` already
had `mice_ballroom_capacity`, `mice_breakout_rooms`, and `is_mice_enabled`
columns from the original schema. So the bulk of this feature was: expose a
way to filter hotels down to the MICE-enabled ones, and build the admin UI —
no new migration, no new workflow engine, low risk. `experiences` in
particular had a working API but **no admin UI anywhere** before this change.

## What changed

### Backend — `xclusiveoman-agent-portal-be`

- `src/models/catalog.model.js` — `createCrudModel(...).list()` now accepts
  an optional `isMiceEnabled` filter, applied only when the target table
  actually has an `is_mice_enabled` column (checked via the table's own
  column list). No-op for `tours`/`activities`/`transfers`/`experiences`.
- `src/controllers/catalog.controller.js` — the generic `list` handler reads
  `?mice=true|false` off the query string and passes it through.
- No migration, no new route file — reuses the existing generic
  `GET /hotels` / `GET /admin/hotels` endpoints, now filterable:
  `GET /admin/hotels?mice=true`.

### Frontend — `xclusiveoman-agent-portal-fe/admin`

- **New page** `src/pages/MiceCatalog.jsx` — tabs for MICE Hotels, Activities,
  Transfers, Experiences, mirroring the existing `ProductCatalog.jsx`
  list-and-add pattern:
  - **MICE Hotels**: lists only `is_mice_enabled = true` hotels (via
    `GET /admin/hotels?mice=true`), showing ballroom capacity / breakout
    rooms columns; add form defaults `isMiceEnabled: true` and exposes
    `miceBallroomCapacity` / `miceBreakoutRooms`, which the general Product
    Catalog's hotel form doesn't.
  - **Activities / Transfers**: same fields as Product Catalog (these tables
    have no MICE-specific columns in the schema, so there's nothing to
    differentiate — documented here rather than faked in the UI).
  - **Experiences**: first admin CRUD for this entity — name, description,
    min/max group size.
- `src/components/icons.jsx` — added `MiceCatalogIcon`.
- `src/components/AdminLayout.jsx` — added a "MICE Catalog" sidebar nav item
  between Product Catalog and NEFT Verification.
- `src/App.jsx` — added the `/mice-catalog` route inside the existing
  `AdminLayout` route group.

## What this deliberately does NOT include

- The MICE Content Hub or curation screen on the agent side (spec §MICE-1 to
  MICE-7) — those consume this catalog data but are a separate, larger piece
  of work (agent-facing curation + RFQ submission).
- The `mice_rfqs` table, RFP dispatch, supplier response tracker, or
  costing/markup/publish workflow (spec §MICE-8 to MICE-14) — today only the
  `mice_rfq` enum literal exists on `bookings.source_type`; the whole RFQ
  workflow is still greenfield and was intentionally left out of this task.
- No new migration was needed or added.

## How to verify

Backend:
```
cd xclusiveoman-agent-portal-be
node --check src/models/catalog.model.js
node --check src/controllers/catalog.controller.js
```

Frontend:
```
cd xclusiveoman-agent-portal-fe/admin
npm run build
npx oxlint src
```

Manual check (needs the backend running + a logged-in staff session):
navigate to `/admin/mice-catalog`, confirm the sidebar highlights "MICE
Catalog", switch between the four tabs, and confirm the Hotels tab only
shows hotels with `is_mice_enabled = true`.
