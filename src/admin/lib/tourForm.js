// Shared Product Catalog `tours` field rules — backend truth is tourSchema
// (validation/schemas.js on the API); this mirrors it client-side so both
// the Product Catalog Tour form (TourEditor.jsx) and the Admin MICE Catalog
// Tour form (MiceCatalog.jsx) validate identically instead of each keeping
// a divergent copy.
export const TOUR_REQUIRED_FIELDS = ['name', 'city', 'description', 'duration', 'category', 'price'];

export function validateTourForm(form, images) {
  for (const key of TOUR_REQUIRED_FIELDS) {
    if (form[key] === undefined || form[key] === null || form[key] === '') {
      return 'Please fill in all required fields.';
    }
  }
  if (images.length === 0) return 'Upload at least one image.';
  if (!(Number(form.price) > 0)) return 'Price (INR) must be a positive number.';
  return '';
}
