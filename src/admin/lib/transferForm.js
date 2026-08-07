// Shared Product Catalog `transfers` field rules — backend truth is
// transferSchema (validation/schemas.js on the API). Unlike hotels/tours,
// images aren't required here: transfers existed without a photo option
// until now, so this stays a nice-to-have rather than a blocking field.
export const TRANSFER_TYPE_OPTIONS = ['airport', 'intercity', 'point_to_point', 'group_coach'];

export const TRANSFER_REQUIRED_FIELDS = ['name', 'type'];

export function validateTransferForm(form) {
  for (const key of TRANSFER_REQUIRED_FIELDS) {
    if (form[key] === undefined || form[key] === null || form[key] === '') {
      return 'Please fill in all required fields.';
    }
  }
  if (form.price !== '' && form.price !== undefined && !(Number(form.price) >= 0)) {
    return 'Price (INR) must be a positive number.';
  }
  return '';
}
