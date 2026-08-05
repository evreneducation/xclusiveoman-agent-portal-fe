import { Card } from './ui.jsx';

// Shared placeholder for sidebar destinations that don't have a backing API
// yet (Notifications Center / FIT Request history — doc §7 screens 20 & 06
// list view — have no corresponding backend routes in this build). Keeps the
// nav item real and navigable without fabricating data the API can't back.
// Renders just the heading + placeholder card, so it can be dropped into
// either a full standalone page or embedded partway down another page
// (e.g. Support.jsx, which shows real RM contact info above this).
export default function ComingSoon({ title, description, children }) {
  return (
    <div>
      {title && <h3 className="mb-1 text-lg font-bold text-agent-ink">{title}</h3>}
      {description && <p className="mb-4 text-sm text-agent-muted">{description}</p>}
      <Card className="border-white text-center">
        <div className="py-10">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-agent-panel text-agent-accent-dark">
            ✦
          </div>
          <p className="text-sm font-semibold text-agent-ink">Coming soon</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-agent-muted">
            This section is on the roadmap and isn't wired up to live data yet.
          </p>
        </div>
      </Card>
      {children}
    </div>
  );
}
