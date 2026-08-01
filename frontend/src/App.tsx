import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import ChatWidget from './components/ChatWidget';

// Lazy-load each route so its code (and heavy deps like the PDF libs used only
// on /results) ships as a separate chunk fetched on demand, rather than in one
// large initial bundle.
const LandingPage = lazy(() => import('./pages/LandingPage'));
const PlanPage = lazy(() => import('./pages/PlanPage'));
const ResultsPage = lazy(() => import('./pages/ResultsPage'));

function App() {
  return (
    // Minimal fallback that matches the app background, so a route chunk loading
    // doesn't flash white. Pages have their own richer loading states.
    <>
      <Suspense fallback={<div className="min-h-screen bg-background" />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/plan" element={<PlanPage />} />
          <Route path="/results" element={<ResultsPage />} />
        </Routes>
      </Suspense>
      <ChatWidget />
    </>
  );
}

export default App;

