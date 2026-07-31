# Xclusive Oman — Frontends

Two independent React + Vite + Tailwind apps for the Xclusive Oman B2B & MICE portal, per the
master documentation (§5.2 "One Domain, Path-Based Routing"): the doc's production layout serves
both from one domain split by path prefix (`/agent/*` vs `/admin/*`), so they live here as sibling
folders rather than separate repos, while still building and deploying independently.

```
agent-portal-fe/
  agent/    the agent-facing app        → xclusiveoman.com/agent/*   (dev: localhost:5173)
  admin/    the staff/admin console     → xclusiveoman.com/admin/*   (dev: localhost:5174)
```

Both talk to the same shared backend, `xclusiveoman-agent-portal-be` — see that repo's README for
DB setup, migrations, and how to seed the first super admin.

## Running both

Each app is a fully independent Vite project (own `package.json`, own `node_modules`, own dev
server port) — there is no shared build tooling or workspace config between them.

```
cd agent && npm install && npm run dev   # http://localhost:5173/agent/login
cd admin && npm install && npm run dev   # http://localhost:5174/admin/login
```

See `agent/README.md` and `admin/README.md` for what each app implements.
