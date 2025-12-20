/**
 * OnboardingWizard Component
 *
 * Phase 14: Customer Onboarding Flow + First Forecast Experience
 *
 * Multi-step wizard for customer onboarding with progress indicator.
 */

import { ReactNode } from 'react';

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    padding: '2rem',
    background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%)',
  },
  progressBar: {
    width: '100%',
    maxWidth: '600px',
    marginBottom: '3rem',
    marginTop: '2rem',
  },
  progressSteps: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'relative' as const,
    marginBottom: '1rem',
  },
  progressLine: {
    position: 'absolute' as const,
    top: '16px',
    left: '0',
    right: '0',
    height: '2px',
    background: 'rgba(255, 255, 255, 0.1)',
    zIndex: 0,
  },
  progressLineFilled: {
    position: 'absolute' as const,
    top: '16px',
    left: '0',
    height: '2px',
    background: 'linear-gradient(90deg, #00d4ff, #7b2cbf)',
    zIndex: 1,
    transition: 'width 0.3s ease',
  },
  step: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '0.5rem',
    zIndex: 2,
    position: 'relative' as const,
  },
  stepCircle: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.875rem',
    fontWeight: 'bold',
    transition: 'all 0.3s ease',
  },
  stepCircleInactive: {
    background: 'rgba(255, 255, 255, 0.1)',
    color: '#666',
  },
  stepCircleActive: {
    background: 'linear-gradient(90deg, #00d4ff, #7b2cbf)',
    color: '#fff',
    boxShadow: '0 0 20px rgba(0, 212, 255, 0.5)',
  },
  stepCircleCompleted: {
    background: '#00c853',
    color: '#fff',
  },
  stepLabel: {
    fontSize: '0.75rem',
    textAlign: 'center' as const,
    maxWidth: '80px',
    transition: 'color 0.3s ease',
  },
  stepLabelInactive: {
    color: '#666',
  },
  stepLabelActive: {
    color: '#fff',
    fontWeight: '500',
  },
  content: {
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '16px',
    padding: '2.5rem',
    maxWidth: '600px',
    width: '100%',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
};

export interface WizardStep {
  id: string;
  label: string;
  number: number;
}

interface OnboardingWizardProps {
  currentStep: number;
  totalSteps: number;
  steps: WizardStep[];
  children: ReactNode;
}

export default function OnboardingWizard({
  currentStep,
  totalSteps,
  steps,
  children,
}: OnboardingWizardProps) {
  const progressPercentage = ((currentStep - 1) / (totalSteps - 1)) * 100;

  return (
    <div style={styles.container}>
      <div style={styles.progressBar}>
        <div style={styles.progressSteps}>
          <div style={styles.progressLine} />
          <div
            style={{
              ...styles.progressLineFilled,
              width: `${progressPercentage}%`,
            }}
          />
          {steps.map((step) => {
            const isActive = step.number === currentStep;
            const isCompleted = step.number < currentStep;

            return (
              <div key={step.id} style={styles.step}>
                <div
                  style={{
                    ...styles.stepCircle,
                    ...(isCompleted
                      ? styles.stepCircleCompleted
                      : isActive
                      ? styles.stepCircleActive
                      : styles.stepCircleInactive),
                  }}
                >
                  {isCompleted ? '✓' : step.number}
                </div>
                <span
                  style={{
                    ...styles.stepLabel,
                    ...(isActive ? styles.stepLabelActive : styles.stepLabelInactive),
                  }}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div style={styles.content}>{children}</div>
    </div>
  );
}
