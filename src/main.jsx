import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// Intercept all relative /api/ fetch calls and redirect them to the configured backend if VITE_API_BASE_URL is set
const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
if (API_BASE) {
  const originalFetch = window.fetch;
  window.fetch = function (input, init) {
    let url = input;
    if (typeof input === 'string' && input.startsWith('/api/')) {
      url = `${API_BASE}${input}`;
    } else if (input instanceof Request && input.url.startsWith('/api/')) {
      const newUrl = `${API_BASE}${input.url}`;
      url = new Request(newUrl, input);
    }
    return originalFetch.call(this, url, init);
  };
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);

