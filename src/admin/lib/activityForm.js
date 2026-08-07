// Shared Product Catalog `activities` field rules — backend truth is
// activitySchema (validation/schemas.js on the API). Unlike hotels/tours,
// images aren't required here: activities existed without a photo option
// until now, so this stays a nice-to-have rather than a blocking field.
export const ACTIVITY_REQUIRED_FIELDS = ['name', 'city'];

export function validateActivityForm(form) {
  for (const key of ACTIVITY_REQUIRED_FIELDS) {
    if (form[key] === undefined || form[key] === null || form[key] === '') {
      return 'Please fill in all required fields.';
    }
  }
  if (form.pricePerPax !== '' && form.pricePerPax !== undefined && !(Number(form.pricePerPax) >= 0)) {
    return 'Price per pax (INR) must be a positive number.';
  }
  return '';
}
