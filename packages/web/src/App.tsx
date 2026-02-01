/**
 * IntentVision Dashboard App
 *
 * Phase 5: Customer Onboarding + Org/API Key Flow
 * Phase E2E: Single-Metric Forecast Demo
 * Phase 10: Sellable Alpha Shell
 * Phase 11: Admin Usage UI
 * Phase 12: Owner Billing UI
 * Beads Tasks: intentvision-p5, intentvision-r4j, intentvision-9xn
 */

import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import OnboardingPage from './pages/OnboardingPage';
import OnboardingSuccessPage from './pages/OnboardingSuccessPage';
import DashboardPage from './pages/DashboardPage';
import AlertsPage from './pages/AlertsPage';
import SettingsPage from './pages/SettingsPage';
import ForecastDemoPage from './pages/ForecastDemoPage';
import UsagePage from './pages/UsagePage';
import BillingPage from './pages/BillingPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      {/* Phase 14: Multi-step onboarding flow */}
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route path="/onboarding/start" element={<OnboardingPage />} />
      <Route path="/onboarding/success" element={<OnboardingSuccessPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/alerts" element={<AlertsPage />} />
      <Route path="/settings/notifications" element={<SettingsPage />} />
      <Route path="/demo/forecast" element={<ForecastDemoPage />} />
      <Route path="/usage" element={<UsagePage />} />
      <Route path="/admin/usage" element={<UsagePage />} />
      <Route path="/billing" element={<BillingPage />} />
      <Route path="/owner/billing" element={<BillingPage />} />
    </Routes>
  );
}
