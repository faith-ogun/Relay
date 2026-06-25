import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './hooks/useAuth';
import { CookieConsent } from './components/CookieConsent';
import './styles.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Open the Cookie Policy via the same client-side router App listens to: push
// the path, then fire popstate so App re-resolves the route (no full reload).
const openCookiePolicy = () => {
  window.history.pushState({}, '', '/cookies');
  window.dispatchEvent(new PopStateEvent('popstate'));
};

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AuthProvider>
      <App />
      {/* Global, route-independent so consent is honoured everywhere (#37). */}
      <CookieConsent onOpenPolicy={openCookiePolicy} />
    </AuthProvider>
  </React.StrictMode>
);
