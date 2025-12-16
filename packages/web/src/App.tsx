/**
 * IntentVision Dashboard App
 *
 * Phase 5: Customer Onboarding + Org/API Key Flow
 * Beads Task: intentvision-p5
 */

import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import OnboardingPage from './pages/OnboardingPage';
import DashboardPage from './pages/DashboardPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
    </Routes>
  );
}
