/**
 * IntentVision Dashboard Entry Point
 *
 * Phase 5: Customer Onboarding + Org/API Key Flow
 * Beads Task: intentvision-p5
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
