// Content Hub "Oman Overview" tab (MiceCatalog.jsx) — mirrors the backend's
// own character-count check (validation/schemas.js's omanOverviewSchema) so
// the admin gets live feedback while typing instead of only finding out on
// submit that the description is too short.
import { isEmptyHtml } from '../../shared/components/RichTextEditor.jsx';

export const OMAN_OVERVIEW_MIN_CHARS = 500;

export function countChars(html) {
  const text = String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[a-zA-Z0-9#]+;/g, ' ')
    .trim();
  return text.length;
}

export function validateOmanOverviewForm(form) {
  if (!form.name?.trim()) return 'Name is required.';
  if (isEmptyHtml(form.description)) return 'Description is required.';
  const chars = countChars(form.description);
  if (chars < OMAN_OVERVIEW_MIN_CHARS) {
    return `Description must be at least ${OMAN_OVERVIEW_MIN_CHARS} characters (currently ${chars}).`;
  }
  if (!form.pdfUrl) return 'Upload a PDF document.';
  if (!form.coverImageUrl) return 'Upload a cover image.';
  return '';
}
