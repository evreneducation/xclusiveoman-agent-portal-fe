# Xclusive Oman — Agent Portal Frontend

React + Vite + Tailwind agent-facing app for the Xclusive Oman B2B & MICE portal, per the master
documentation (§5 Tech Stack, §7 Wireframe Screen Reference). The admin console lives alongside
this app as a sibling folder — `../admin` (dev on `http://localhost:5174/admin/login`) — sharing
the same backend (`xclusiveoman-agent-portal-be`).

**Scope so far**: Sprints 1–3 — auth/dashboard (screens 01–02), Fixed Group Departures listing,
detail, and instant booking (screens 03–04), and payments (screens 25–26). The remaining wireframe
screens (Custom FIT, MICE, documents, notifications, reviews, support) are later-sprint work.

## Stack

React 19 (JS, not TS) + Vite, Tailwind CSS v3 (utility classes only — no separate hand-written
CSS beyond the Tailwind directives file), React Router v6, socket.io-client.

## Setup

1. Make sure the backend (`xclusiveoman-agent-portal-be`) is running on `http://localhost:4000`
   (see its README for DB + super-admin bootstrap steps).
2. From this folder (`agent/`): `npm install`
3. `npm run dev`
4. Open **`http://localhost:5173/agent/login`** — not the bare root URL. The router is mounted
   with `basename="/agent"` to match the doc's production path-based routing
   (`xclusiveoman.com/agent/*` vs `/admin/*`), so routes only resolve under `/agent/*`.

The dev server proxies `/api` and `/socket.io` to the backend (see `vite.config.js`), so the app
runs same-origin against the API in development — no CORS configuration or `.env` needed for the
default setup. `.env.example` only matters if you point the frontend at a non-local API.

## What's implemented

- **Login/Registration** (screen 01) and **Dashboard** (screen 02): auth wired to `/api/auth/*`,
  RM contact card, live Socket.IO indicator.
- **FGD Listing & Detail/Booking** (screens 03–04): destination/featured/bestseller filters,
  tiered pricing resolved server-side, add-ons priced live, Book Instantly (with seat locking and
  waitlist fallback) and Enquire Now (WhatsApp deep link).
- **Payment & Transaction History** (screens 25–26): Cashfree hosted checkout handoff, NEFT slip
  upload, transaction list. Cashfree/Cloudinary need real keys in the backend's `.env` to actually
  complete a payment — see the backend README.
- Access token kept in memory (React context), refresh token in an httpOnly cookie set by the
  backend; a 401 triggers one silent refresh-and-retry before logging the user out.

## Project layout

```
src/
  api/client.js          fetch wrapper: base '/api', credentials included, 401 -> refresh -> retry
  context/AuthContext.jsx login/register/logout, current user, socket connection state
  lib/socket.js           socket.io-client wiring
  routes/ProtectedRoute.jsx
  components/ui.jsx       small Tailwind building blocks (Button, Card, Badge, Tag, TextInput...)
  pages/                   Login, Dashboard, Departures, DepartureDetail, Payment, Transactions
  App.jsx, main.jsx
```
