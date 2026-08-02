import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// Intercept all relative /api/ fetch calls and redirect them to the configured backend if VITE_API_BASE_URL is set
const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
if (API_BASE) {
  try {
    const originalFetch = window.fetch;
    if (originalFetch) {
      const customFetch = function (input, init) {
        let url = input;
        if (typeof input === 'string' && input.startsWith('/api/')) {
          url = `${API_BASE}${input}`;
        } else if (input instanceof Request && input.url.startsWith('/api/')) {
          const newUrl = `${API_BASE}${input.url}`;
          url = new Request(newUrl, input);
        }
        return originalFetch.call(this, url, init);
      };

      try {
        Object.defineProperty(window, 'fetch', {
          value: customFetch,
          configurable: true,
          writable: true,
          enumerable: true
        });
      } catch (defErr) {
        // Fallback to direct assignment
        window.fetch = customFetch;
      }
    }
  } catch (err) {
    console.warn("Could not intercept window.fetch due to sandbox restrictions:", err);
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);

