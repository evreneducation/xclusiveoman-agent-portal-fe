// Shared Product Catalog `hotels` field rules — backend truth is
// hotelSchema (validation/schemas.js on the API); this mirrors it client-side
// so both the Product Catalog Hotel form (HotelEditor.jsx) and the Admin
// MICE Catalog Hotel form (MiceCatalog.jsx) validate identically instead of
// each keeping a divergent copy.
export const STAR_OPTIONS = [3, 4, 5];

export const HOTEL_REQUIRED_FIELDS = ['name', 'city', 'state', 'address', 'email', 'category', 'description', 'pricePerNight'];

export function validateHotelForm(form, images) {
  for (const key of HOTEL_REQUIRED_FIELDS) {
    if (form[key] === undefined || form[key] === null || form[key] === '') {
      return 'Please fill in all required fields.';
    }
  }
  if (images.length === 0) return 'Upload at least one image.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'Enter a valid email address.';
  if (!(Number(form.pricePerNight) > 0)) return 'Price (INR per night) must be a positive number.';
  return '';
}
