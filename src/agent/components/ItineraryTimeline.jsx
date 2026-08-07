import { ITINERARY_ITEM_TYPE_META } from '../../shared/itinerary/index.js';
import { Card } from './ui.jsx';

// Read-only Day-wise Itinerary display (FIT-5) — shared by the Custom FIT
// Builder's Review step (a live preview of what's about to be submitted) and
// QuoteDetail.jsx (the submitted/published request, admin edits and all).
// Same component in both places is what makes "the finalized version is
// shown back to the agent exactly as approved" true by construction rather
// than by two renderers happening to agree.
//
// `days` is the wire shape: [{ dayNumber, notes, items: [{ type, id, name,
// city, images }] }] — either the backend's composeItinerary() output, or
// PackageBuilder's local equivalent built from the in-progress selection.
export default function ItineraryTimeline({ days, emptyLabel = 'No day-wise itinerary added.' }) {
  if (!days || days.length === 0) {
    return (
      <Card label="Day-wise itinerary" className="border-white">
        <p className="text-sm text-agent-muted">{emptyLabel}</p>
      </Card>
    );
  }

  return (
    <Card label="Day-wise itinerary" className="border-white">
      <div className="space-y-0">
        {days.map((day, idx) => (
          <div key={day.dayNumber} className="relative flex gap-4 pb-5 last:pb-0">
            {idx < days.length - 1 && (
              <span className="absolute left-[15px] top-8 h-[calc(100%-1.25rem)] w-px bg-agent-line-light" />
            )}
            <span className="relative z-10 flex h-8 w-8 flex-none items-center justify-center rounded-full bg-agent-ink text-xs font-bold text-white shadow-sm">
              {day.dayNumber}
            </span>
            <div className="flex-1 pt-1">
              <div className="mb-1.5 text-xs font-bold uppercase tracking-wide text-agent-accent-dark">Day {day.dayNumber}</div>
              {day.items.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {day.items.map((item, itemIdx) => {
                    const meta = ITINERARY_ITEM_TYPE_META[item.type];
                    return (
                      <span
                        key={`${item.type}:${item.id}:${itemIdx}`}
                        className="inline-flex items-center gap-1.5 rounded-full border border-agent-line-light bg-agent-panel px-2.5 py-1 text-[11px] font-semibold text-agent-ink"
                      >
                        <span>{meta?.icon}</span>
                        {item.name || meta?.label || 'Item'}
                      </span>
                    );
                  })}
                </div>
              )}
              {day.notes && <p className="text-sm text-agent-ink">{day.notes}</p>}
              {day.items.length === 0 && !day.notes && (
                <p className="text-sm text-agent-muted">Nothing planned yet.</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
