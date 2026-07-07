import { createRoot } from 'react-dom/client';
import { setBaseUrl } from '@workspace/api-client-react';

import App from './App';

import './index.css';

// When running inside Capacitor (iOS/Android), there is no browser proxy to
// route /api/* calls.  VITE_API_BASE_URL must be set at build time to the
// deployed API server URL (e.g. https://api.mydigitalcloset.com).
// In the normal Replit web build this variable is absent and relative /api/*
// URLs are used as-is.
if (import.meta.env.VITE_API_BASE_URL) {
  setBaseUrl(import.meta.env.VITE_API_BASE_URL as string);
}

createRoot(document.getElementById('root')!).render(<App />);
