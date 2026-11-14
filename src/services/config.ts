/** Base URL of the backend API without a trailing slash. */
export const API_BASE_URL: string = (
  import.meta.env.VITE_API_BASE_URL?.trim() ||
  '/api/v1'
).replace(/\/+$/, '')
