// Content Hub "Oman Overview" tab (MiceCatalog.jsx) — mirrors the backend's
// own word-count check (validation/schemas.js's omanOverviewSchema) so the
// admin gets live feedback while typing instead of only finding out on
// submit that the description is too short/long.
import { isEmptyHtml } from '../../shared/components/RichTextEditor.jsx';

export const OMAN_OVERVIEW_MIN_WORDS = 10;
export const OMAN_OVERVIEW_MAX_WORDS = 500;

export function countWords(html) {
  const text = String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[a-zA-Z0-9#]+;/g, ' ')
    .trim();
  return text ? text.split(/\s+/).length : 0;
}

export function validateOmanOverviewForm(form) {
  if (!form.name?.trim()) return 'Name is required.';
  if (isEmptyHtml(form.description)) return 'Description is required.';
  const words = countWords(form.description);
  if (words < OMAN_OVERVIEW_MIN_WORDS || words > OMAN_OVERVIEW_MAX_WORDS) {
    return `Description must be between ${OMAN_OVERVIEW_MIN_WORDS} and ${OMAN_OVERVIEW_MAX_WORDS} words (currently ${words}).`;
  }
  if (!form.pdfUrl) return 'Upload a PDF document.';
  if (!form.coverImageUrl) return 'Upload a cover image.';
  return '';
}
