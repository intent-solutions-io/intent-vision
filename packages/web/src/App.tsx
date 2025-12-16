/**
 * IntentVision Dashboard App
 *
 * Phase 5: Customer Onboarding + Org/API Key Flow
 * Phase E2E: Single-Metric Forecast Demo
 * Phase 10: Sellable Alpha Shell
 * Beads Tasks: intentvision-p5, intentvision-r4j, intentvision-9xn
 */

import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import OnboardingPage from './pages/OnboardingPage';
import DashboardPage from './pages/DashboardPage';
import AlertsPage from './pages/AlertsPage';
import SettingsPage from './pages/SettingsPage';
import ForecastDemoPage from './pages/ForecastDemoPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/alerts" element={<AlertsPage />} />
      <Route path="/settings/notifications" element={<SettingsPage />} />
      <Route path="/demo/forecast" element={<ForecastDemoPage />} />
    </Routes>
  );
}
