/** Base URL of the backend API without a trailing slash. */
export const API_BASE_URL: string = (
  import.meta.env.VITE_API_BASE_URL?.trim() ||
  `${window.location.protocol}//${window.location.hostname}:8001/api/v1`
).replace(/\/+$/, "");
