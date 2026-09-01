// Shared Product Catalog `tours` field rules — backend truth is tourSchema
// (validation/schemas.js on the API); this mirrors it client-side so both
// the Product Catalog Tour form (TourEditor.jsx) and the Admin MICE Catalog
// Tour form (MiceCatalog.jsx) validate identically instead of each keeping
// a divergent copy.
import { isEmptyHtml } from '../../shared/components/RichTextEditor.jsx';

export const TOUR_REQUIRED_FIELDS = ['name', 'city', 'description', 'duration', 'category', 'price', 'pickupTime'];

// description is rich text now — its empty state is `<p></p>`, not `''`.
const HTML_FIELDS = new Set(['description']);

export function validateTourForm(form, images) {
  for (const key of TOUR_REQUIRED_FIELDS) {
    const empty = HTML_FIELDS.has(key) ? isEmptyHtml(form[key]) : form[key] === undefined || form[key] === null || form[key] === '';
    if (empty) {
      return 'Please fill in all required fields.';
    }
  }
  if (images.length === 0) return 'Upload at least one image.';
  if (!(Number(form.price) > 0)) return 'Price (INR) must be a positive number.';
  return '';
}
