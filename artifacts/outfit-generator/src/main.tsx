import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { initializeRevenueCat } from './lib/revenuecat';
import { startVisionIndexer } from './lib/visionIndexer';

// Kick off RC configure() at startup — before React mounts — so the SDK is
// ready by the time any component calls getOfferings() or getCustomerInfo().
initializeRevenueCat().catch(console.warn);

// Start background photo-analysis indexer (runs after a short delay so the
// app paints first; no-op if everything is already indexed).
startVisionIndexer().catch(console.warn);

// IndexedDB initialises lazily on first query — no explicit init needed here.
// All data is local; no API base URL or token setup required.

createRoot(document.getElementById('root')!).render(<App />);
