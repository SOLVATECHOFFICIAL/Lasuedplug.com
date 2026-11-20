import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then(() => navigator.serviceWorker.ready)
      .then(async () => {
        if (!('caches' in window)) return;
        const cache = await caches.open('lasuedplug-static-v1');
        const assetUrls = Array.from(
          document.querySelectorAll<HTMLScriptElement | HTMLLinkElement>(
            'script[src], link[rel="stylesheet"][href]'
          )
        )
          .map((el) => ('src' in el ? el.src : el.href))
          .filter(
            (href) =>
              href.startsWith(window.location.origin) &&
              !href.includes('/@vite/') &&
              !href.includes('/@react-refresh')
          );

        await Promise.allSettled(
          assetUrls.map((assetUrl) =>
            cache
              .match(assetUrl)
              .then((hit) => (hit ? undefined : cache.add(assetUrl)))
          )
        );
      })
      .catch((err) => {
        console.warn('Service worker registration failed:', err);
      });
  });
}
