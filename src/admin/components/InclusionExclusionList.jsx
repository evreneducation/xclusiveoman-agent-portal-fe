import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { FieldLabel, Select, TextInput } from './ui.jsx';

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

// True if any day of a composed itinerary ({dayNumber, notes, items: [{type,
// ...}]}) carries an item of this type — drives both pages' Inclusions
// default-seed (hotel -> "Accommodation", tour -> "Tours", activity ->
// "Activity"; meals are checked separately since they're a package-wide
// add-on, not a per-day itinerary item).
export function itineraryHasItemType(itinerary, type) {
  return (itinerary || []).some((day) => (day.items || []).some((item) => item.type === type));
}

// Inclusions/Exclusions editor — a select box sourced from the Product
// Catalog's own Inclusions/Exclusions tab (GET /inclusions, /exclusions —
// see catalog.routes.js/admin/pages/ProductCatalog.jsx's
// InclusionsExclusionsTab), picking an option adds it to the list
// immediately (no separate "Add" click), and every added point stays a
// plain editable text field so the admin can tweak the wording (e.g. add
// night counts) or delete it outright.
export function InclusionExclusionList({ catalogEntityPath, label, items, onItemsChange }) {
  const [catalogOptions, setCatalogOptions] = useState([]);

  useEffect(() => {
    api
      .get(`/${catalogEntityPath}`)
      .then((data) => setCatalogOptions(data[catalogEntityPath] || []))
      .catch(() => {});
  }, [catalogEntityPath]);

  function handlePick(e) {
    const id = e.target.value;
    e.target.value = ''; // one-shot picker — always resets back to the placeholder
    if (!id) return;
    const chosen = catalogOptions.find((o) => o.id === id);
    if (!chosen || items.includes(chosen.name)) return;
    onItemsChange([...items, chosen.name]);
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
      <Select defaultValue="" onChange={handlePick} className="mb-2">
        <option value="">+ Add from catalog…</option>
        {catalogOptions.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </Select>
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
