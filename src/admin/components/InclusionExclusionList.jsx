import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { FieldLabel, TextInput } from './ui.jsx';
import { itineraryHasItemType } from '../../shared/itinerary/index.js';

// True if any day of a composed itinerary ({dayNumber, notes, items: [{type,
// ...}]}) carries an item of this type — drives both pages' Inclusions
// default-seed (hotel -> "Accommodation", tour -> "Tours", activity ->
// "Activity"; meals are checked separately since they're a package-wide
// add-on, not a per-day itinerary item). Re-exported for backward
// compatibility — FdPackageEditor.jsx and QuoteInboxDetail.jsx both still
// import this from here. The actual implementation now lives in
// shared/itinerary/index.js so read-only pages outside admin
// (agent/pages/DepartureDetail.jsx) can use it too, without importing an
// admin component into the agent tree.
export { itineraryHasItemType };

// Shared by QuoteInboxDetail.jsx (Custom FIT quotes) and FdPackageEditor.jsx
// (FD Packages) — both persist Inclusions/Exclusions as one newline-
// delimited TEXT column each (0048_package_request_inclusions_exclusions.sql
// / 0050_fd_packages_inclusions_exclusions.sql), edited here as a list of
// separately add/edit/removable points. These two just cross the boundary
// between "one string" and "one point per line" in each direction.
export function linesFromText(text) {
  return (text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export function textFromLines(lines) {
  return lines.join('\n');
}

// Inclusions/Exclusions editor — a combobox sourced from the Product
// Catalog's own Inclusions/Exclusions tab (GET /inclusions, /exclusions —
// see catalog.routes.js/admin/pages/ProductCatalog.jsx's
// InclusionsExclusionsTab): typing filters the catalog list, clicking a
// matching option adds it immediately, and typing something that isn't in
// the catalog at all surfaces a "+ Add "…" as new" action in the same
// dropdown (or just pressing Enter) instead of needing a separate text
// field next to it. Either way the point lands in `items` as a plain
// editable text field so the admin can tweak the wording (e.g. add night
// counts) or delete it outright; a manually-typed point is never written
// back into the reusable Product Catalog itself (that's still only done
// from Product Catalog's own Inclusions & Exclusions tab).
export function InclusionExclusionList({ catalogEntityPath, label, items, onItemsChange }) {
  const [catalogOptions, setCatalogOptions] = useState([]);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    api
      .get(`/${catalogEntityPath}`)
      .then((data) => setCatalogOptions(data[catalogEntityPath] || []))
      .catch(() => {});
  }, [catalogEntityPath]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function addText(text) {
    const trimmed = text.trim();
    if (!trimmed || items.includes(trimmed)) return;
    onItemsChange([...items, trimmed]);
    setQuery('');
    setOpen(false);
  }

  const trimmedQuery = query.trim();
  const filtered = trimmedQuery
    ? catalogOptions.filter((o) => o.name.toLowerCase().includes(trimmedQuery.toLowerCase()))
    : catalogOptions;
  const hasExactCatalogMatch = catalogOptions.some((o) => o.name.toLowerCase() === trimmedQuery.toLowerCase());

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addText(trimmedQuery);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  function updateItem(idx, text) {
    onItemsChange(items.map((it, i) => (i === idx ? text : it)));
  }

  function removeItem(idx) {
    onItemsChange(items.filter((_, i) => i !== idx));
  }

  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div ref={boxRef} className="relative mb-2">
        <TextInput
          placeholder="+ Add from catalog… or type your own"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={handleKeyDown}
        />
        {open && (
          <div className="absolute inset-x-0 z-20 mt-1 max-h-52 overflow-y-auto rounded-md border border-line-light bg-white p-1 shadow-lg">
            {trimmedQuery && !hasExactCatalogMatch && (
              <button
                type="button"
                onClick={() => addText(trimmedQuery)}
                className="flex w-full items-center rounded-md px-2.5 py-2 text-left text-xs font-semibold text-accent hover:bg-panel"
              >
                + Add “{trimmedQuery}” as new
              </button>
            )}
            {filtered.length === 0 ? (
              !trimmedQuery && (
                <p className="px-2.5 py-2 text-xs text-muted">No catalog entries yet — type to add your own.</p>
              )
            ) : (
              filtered.map((o) => {
                const alreadyAdded = items.includes(o.name);
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => addText(o.name)}
                    disabled={alreadyAdded}
                    className={`flex w-full items-center rounded-md px-2.5 py-2 text-left text-xs ${
                      alreadyAdded ? 'cursor-not-allowed text-muted' : 'text-ink hover:bg-panel'
                    }`}
                  >
                    {o.name}
                    {alreadyAdded ? ' (added)' : ''}
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted">None added yet.</p>
      ) : (
        <div className="space-y-2">
          {items.map((text, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <TextInput className="flex-1" value={text} onChange={(e) => updateItem(idx, e.target.value)} />
              <button type="button" onClick={() => removeItem(idx)} className="text-xs text-[#a5162d] hover:underline">
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
