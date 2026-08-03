# Xclusive Oman — Portal Frontend

React + Vite + Tailwind frontend for the Xclusive Oman B2B & MICE portal, per the master
documentation (§5 Tech Stack, §5.2 "One Domain, Path-Based Routing", §7 Wireframe Screen
Reference). A single app serves both the agent-facing portal and the staff/admin console, split by
path prefix under one `BrowserRouter`:

```
src/
  agent/    the agent-facing app        → /agent/*
  admin/    the staff/admin console     → /admin/*
  shared/   code used by both (API client, socket, the "/" landing chooser)
```

Both modules talk to the same shared backend, `xclusiveoman-agent-portal-be` — see that repo's
README for DB setup, migrations, and how to seed the first super admin.

## Running

One `package.json`, one dev server, one build:

```
npm install
npm run dev     # http://localhost:5173/
npm run build
```

- `http://localhost:5173/` — a small chooser page linking to each module.
- `http://localhost:5173/agent/login` — agent portal.
- `http://localhost:5173/admin/login` — admin console.

Make sure the backend (`xclusiveoman-agent-portal-be`) is running on `http://localhost:4000`,
migrated, and has at least one super admin — either:
- `npm run seed` in the backend (dev default: `admin@xclusiveoman.com` / `Admin@12345`), or
- `npm run create-super-admin -- you@example.com "StrongPass123" "Your Name"`

The dev server proxies `/api` and `/socket.io` to the backend (see `vite.config.js`) — no CORS
setup needed locally. In production, set `VITE_API_PROXY_TARGET` to the backend's absolute URL
(see `.env.production`) since the built app is no longer same-origin with the API by default.

## What's implemented

**Agent portal** (`src/agent`) — Sprints 1–3: auth/dashboard (screens 01–02), Fixed Group
Departures listing, detail, and instant booking (screens 03–04), and payments (screens 25–26).
Cashfree/Cloudinary need real keys in the backend's `.env` to actually complete a payment.

**Admin console** (`src/admin`) — Admin Login (screen 09), Agent Approvals (screen 10), Product
Catalog + Add/Edit FD Package (screens 12–13), NEFT Verification (screen 31), Transaction Ledger
(screen 30).

Both modules share the auth plumbing pattern (in-memory access token, httpOnly refresh cookie,
automatic refresh-and-retry on 401, live Socket.IO connection indicator) via
`src/shared/api/createApiClient.js` and `src/shared/socket/createSocketClient.js` — each module
instantiates its own isolated client so an agent session and an admin session never share a token
or socket connection even though they're now in the same JS bundle. `/agent` and `/admin` remain
fully separate auth contexts: the admin app enforces client-side that only internal staff (no
`agency_id`) may hold an admin session (see `AUTH-7` in `src/admin/context/AuthContext.jsx`).

`components/ui.jsx`, `context/AuthContext.jsx`, and `routes/ProtectedRoute.jsx` are intentionally
**not** shared — admin's `ui.jsx` uses framer-motion and different styling than agent's, and the
two `AuthContext.jsx` files have real behavioral differences (staff-only gating + `isSuperAdmin` in
admin; `register` in agent).

## Known limitations (admin console)

- The wireframe's "Request More Info" action isn't implemented — the backend's `agency_status`
  enum only has `pending / approved / rejected / suspended`, so only Approve and Reject are wired.
- No 2FA (the wireframe shows a checkbox for it; the backend doesn't implement it yet).
- Agency contact email isn't shown on the approvals detail panel — `GET /admin/agencies` doesn't
  currently return the owner user's contact info, only agency-level fields.
