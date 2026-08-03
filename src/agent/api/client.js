import { createApiClient } from '../../shared/api/createApiClient.js';

export const { api, setAccessToken, getAccessToken, setUnauthorizedHandler, tryRefresh } = createApiClient();
