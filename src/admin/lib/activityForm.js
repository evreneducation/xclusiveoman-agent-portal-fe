// Shared Product Catalog `activities` field rules — backend truth is the
// requireActivityPublishFields gate (routes/catalog.routes.js on the API);
// this mirrors it client-side so the Product Catalog Activity form
// (ActivityEditor.jsx) and the Admin MICE Catalog Activity form
// (MiceCatalog.jsx) validate identically. Only enforced on a full "Save"
// (publish) — the Save-as-Draft path stays lenient.
import { isEmptyHtml } from '../../shared/components/RichTextEditor.jsx';

export const ACTIVITY_REQUIRED_FIELDS = ['name', 'city', 'description', 'duration', 'pricePerPax', 'pickupTime'];

// description is rich text — its empty state is `<p></p>`, not `''`.
const HTML_FIELDS = new Set(['description']);

export function validateActivityForm(form, images = []) {
  for (const key of ACTIVITY_REQUIRED_FIELDS) {
    const empty = HTML_FIELDS.has(key)
      ? isEmptyHtml(form[key])
      : form[key] === undefined || form[key] === null || form[key] === '';
    if (empty) {
      return 'Please fill in all required fields.';
    }
  }
  if (images.length === 0) return 'Upload at least one image.';
  if (!(Number(form.pricePerPax) > 0)) return 'Price per pax (INR) must be a positive number.';
  return '';
}
