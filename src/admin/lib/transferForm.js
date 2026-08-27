// Shared Product Catalog `transfers` field rules — backend truth is the
// requireTransferPublishFields gate (routes/catalog.routes.js on the API);
// this mirrors it client-side so the Product Catalog Transfer form
// (TransferEditor.jsx) and the Admin MICE Catalog Transfer form
// (MiceCatalog.jsx) validate identically. Only enforced on a full "Save"
// (publish) — the Save-as-Draft path stays lenient.
import { isEmptyHtml } from '../../shared/components/RichTextEditor.jsx';

export const TRANSFER_TYPE_OPTIONS = ['airport', 'intercity', 'point_to_point', 'group_coach'];

export const TRANSFER_REQUIRED_FIELDS = ['name', 'type', 'city', 'vehicleClass', 'description', 'price'];

// description is rich text — its empty state is `<p></p>`, not `''`.
const HTML_FIELDS = new Set(['description']);

export function validateTransferForm(form, images = []) {
  for (const key of TRANSFER_REQUIRED_FIELDS) {
    const empty = HTML_FIELDS.has(key)
      ? isEmptyHtml(form[key])
      : form[key] === undefined || form[key] === null || form[key] === '';
    if (empty) {
      return 'Please fill in all required fields.';
    }
  }
  if (images.length === 0) return 'Upload at least one image.';
  if (!(Number(form.price) > 0)) return 'Price (INR) must be a positive number.';
  return '';
}
