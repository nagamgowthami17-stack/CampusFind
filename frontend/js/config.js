/**
 * CampusFind - API Configuration
 * Centralizes the backend API base URL for both local development and production.
 */
(function (global) {
  // Determine if application is running in local development
  const isLocalhost = Boolean(
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '' ||
    window.location.protocol === 'file:'
  );

  // Production Render Backend URL:
  // Update this placeholder with your live Render backend URL after deploying (e.g. 'https://campusfind-api.onrender.com')
  const PRODUCTION_API_URL = 'https://campusfind-api.onrender.com';

  const API_BASE_URL = isLocalhost ? 'http://127.0.0.1:5000' : PRODUCTION_API_URL;

  global.APP_CONFIG = {
    API_BASE_URL: API_BASE_URL,
    IS_LOCAL: isLocalhost
  };
})(window);
