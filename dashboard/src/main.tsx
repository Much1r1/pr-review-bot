import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConvexProvider, ConvexReactClient } from 'convex/react';
import App from './App';
import './index.css';

const envConvexUrl = import.meta.env.VITE_CONVEX_URL;
if (!envConvexUrl) {
  console.warn(
    '[PR-Review-Bot Dashboard] VITE_CONVEX_URL environment variable is missing. ' +
      'Falling back to default demo URL. Data loading may fail if backend is not available.'
  );
}

const convexUrl = envConvexUrl || 'https://dummy.convex.cloud';
const convex = new ConvexReactClient(convexUrl);

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Failed to find root element with id 'root'. Cannot mount React application.");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ConvexProvider client={convex}>
      <App />
    </ConvexProvider>
  </React.StrictMode>
);
