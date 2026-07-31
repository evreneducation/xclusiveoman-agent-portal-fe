# Xclusive Oman — Admin Portal Frontend

React + Vite + Tailwind staff/admin console for the Xclusive Oman B2B & MICE portal, per the
master documentation (§5 Tech Stack, §7 Wireframe Screen Reference). It talks to the same shared
backend as the agent portal (`xclusiveoman-agent-portal-be`) — there is no separate admin backend.
The agent portal lives alongside this app as a sibling folder — `../agent`.

**Scope so far**: Admin Login (screen 09), Agent Approvals (screen 10), Product Catalog + Add/Edit
FD Package (screens 12–13), NEFT Verification (screen 31), Transaction Ledger (screen 30). The
other admin screens (quotes/pricing, marketing, analytics, operations, MICE catalog, etc.) are
later-sprint work.

## Stack

React 19 (JS, not TS) + Vite, Tailwind CSS v3 (utility classes only), React Router v6,
socket.io-client. Same conventions and shared component style as `../agent`.

## Setup

1. Make sure the backend (`xclusiveoman-agent-portal-be`) is running on `http://localhost:4000`,
   migrated, and has at least one super admin — either:
   - `npm run seed` in the backend (dev default: `admin@xclusiveoman.com` / `Admin@12345`), or
   - `npm run create-super-admin -- you@example.com "StrongPass123" "Your Name"`
2. From this folder (`admin/`): `npm install`
3. `npm run dev` — this app is pinned to **port 5174** (see `vite.config.js`) so it can run
   alongside the agent portal (5173) against the same backend.
4. Open **`http://localhost:5174/admin/login`**. The router is mounted with `basename="/admin"`
   to match the doc's production path-based routing, so routes only resolve under `/admin/*`.

The dev server proxies `/api` and `/socket.io` to the backend, same as the agent portal — no CORS
setup needed locally.

## What's implemented

- **Admin Login** (screen 09): work email + password against the same `/api/auth/login` endpoint
  the agent portal uses. This app enforces the `/agent` vs `/admin` context split on the client:
  if the account belongs to an agency (not internal staff), it's logged straight back out with an
  error telling the user to use the agent portal instead (see `AUTH-7` in the doc).
- **Agent Approvals** (screen 10): status-filterable agency list, submitted details panel, and —
  for `super_admin` users only — a decision panel to set tier, credit limit, assign a Relationship
  Manager, and Approve/Reject. Other staff see it read-only, matching backend RBAC.
- **Product Catalog** (screen 12) + **Add/Edit FD Package** (screen 13): tabbed catalog CRUD
  (hotels/tours/activities/transfers) and the full FD package editor (basics, tiered rates,
  departure dates, day-by-day itinerary, add-ons, merchandising flags, draft/publish).
- **NEFT Verification** (screen 31) + **Transaction Ledger** (screen 30): pending-slip review with
  approve/reject, and the filterable agency-wide transaction list.
- Same auth plumbing as the agent portal: in-memory access token, httpOnly refresh cookie,
  automatic refresh-and-retry on 401, live Socket.IO connection indicator in the top bar.

## Known limitations

- The wireframe's "Request More Info" action isn't implemented — the backend's `agency_status`
  enum only has `pending / approved / rejected / suspended`, so only Approve and Reject are wired.
- No 2FA (the wireframe shows a checkbox for it; the backend doesn't implement it yet).
- Agency contact email isn't shown on the approvals detail panel — `GET /admin/agencies` doesn't
  currently return the owner user's contact info, only agency-level fields.

## Project layout

```
src/
  api/client.js            fetch wrapper: base '/api', credentials included, 401 -> refresh -> retry
  context/AuthContext.jsx  login/logout, staff-only enforcement, socket connection state
  lib/socket.js            socket.io-client wiring
  routes/ProtectedRoute.jsx
  components/ui.jsx        small Tailwind building blocks (Button, Card, Badge, Tag, Table...)
  pages/                    Login, AgentApprovals, ProductCatalog, FdPackageEditor,
                             NeftVerification, TransactionLedger
  App.jsx, main.jsx
```
