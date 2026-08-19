import { createApiClient } from '../shared/api/createApiClient.js';

// Public CMS Page Viewer (Task 21 — Item 34 continuation). Mirrors
// admin/api/client.js and agent/api/client.js's own one-line pattern — a
// third, independent createApiClient() instance for public (unauthenticated)
// pages, so it never shares access-token/401-handler state with either
// portal's own client. No token is ever set on this instance; every request
// it makes is anonymous, matching GET /api/cms/pages/:slug's own public,
// unauthenticated nature.
export const { api } = createApiClient();
