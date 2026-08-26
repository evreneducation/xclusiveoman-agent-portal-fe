// Shared Product Catalog `hotels` field rules — backend truth is
// hotelSchema (validation/schemas.js on the API); this mirrors it client-side
// so both the Product Catalog Hotel form (HotelEditor.jsx) and the Admin
// MICE Catalog Hotel form (MiceCatalog.jsx) validate identically instead of
// each keeping a divergent copy.
import { isEmptyHtml } from '../../shared/components/RichTextEditor.jsx';

export const STAR_OPTIONS = [3, 4, 5];

export const HOTEL_REQUIRED_FIELDS = ['name', 'city', 'state', 'address', 'email', 'category', 'description'];

// description is rich text now — its empty state is `<p></p>`, not `''`.
const HTML_FIELDS = new Set(['description']);

// Occupancy-tiered pricing (0061_hotel_occupancy_pricing.sql) — HotelEditor.jsx's
// form now collects singlePrice/doublePrice/triplePrice (checkbox per
// occupancy type); MiceCatalog.jsx's MiceHotelForm keeps its own simpler
// single "Price (per night)" field internally under the legacy
// `pricePerNight` key (only mapped to doublePrice when it actually submits
// — see that file's own comment), so this checks for at least one of all
// four rather than requiring any specific one.
const PRICE_FIELDS = ['pricePerNight', 'singlePrice', 'doublePrice', 'triplePrice'];

export function validateHotelForm(form, images) {
  for (const key of HOTEL_REQUIRED_FIELDS) {
    const empty = HTML_FIELDS.has(key) ? isEmptyHtml(form[key]) : form[key] === undefined || form[key] === null || form[key] === '';
    if (empty) {
      return 'Please fill in all required fields.';
    }
  }
  if (images.length === 0) return 'Upload at least one image.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'Enter a valid email address.';
  if (!PRICE_FIELDS.some((key) => Number(form[key]) > 0)) {
    return 'Set a price for at least one occupancy type (single, double, or triple).';
  }
  return '';
}
