import { Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import PlanPage from './pages/PlanPage';
import ResultsPage from './pages/ResultsPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/plan" element={<PlanPage />} />
      <Route path="/results" element={<ResultsPage />} />
    </Routes>
  );
}

export default App;
