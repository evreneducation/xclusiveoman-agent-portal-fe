import { Card } from './ui.jsx';

// Shared placeholder for sidebar destinations that don't have a backing
// feature yet (Bookings & Documents, Marketing, Analytics, Support — none of
// these have routes/controllers in this backend build). Keeps the nav item
// real and navigable without fabricating data the API can't back.
export default function ComingSoon({ title, description }) {
  return (
    <div className="mx-auto max-w-3xl p-6 lg:p-10">
      <h2 className="mb-1 text-3xl font-bold text-ink">{title}</h2>
      {description && <p className="mb-6 text-sm text-muted">{description}</p>}
      <Card className="border-white text-center">
        <div className="py-14">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent">
            ✦
          </div>
          <p className="text-sm font-semibold text-ink">Coming soon</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted">
            This section is on the roadmap and isn't wired up to live data yet.
          </p>
        </div>
      </Card>
    </div>
  );
}
