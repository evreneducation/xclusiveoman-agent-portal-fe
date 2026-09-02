// One shared "download this document" helper — replaces three separate,
// near-identical copies that used to live in agent/admin/team's own
// BookingDetail.jsx pages. Each of those hand-rolled its own filename
// client-side (e.g. `passport_scan_${traveler.name}`) with no file
// extension at all, so the saved file's real type was invisible to the OS —
// exactly why a downloaded passport scan or visa copy could come out looking
// "changed"/unopenable. This instead trusts the filename the server already
// sends back (api.getBlobWithFilename reads it off the Content-Disposition
// header — see createApiClient.js), which every document-download endpoint
// here already names correctly, extension included.
//
// `api` is the caller's own portal-scoped client (agent/admin/team each
// instantiate their own — see createApiClient.js), so this stays agnostic of
// which portal is calling it, same convention NotificationBell.jsx already
// established for this directory.
export async function downloadDocument(api, path, fallbackFilename = 'document') {
  const { blob, filename } = await api.getBlobWithFilename(path);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || fallbackFilename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
