/**
 * Project Service
 *
 * Phase 14: Customer Onboarding Flow + First Forecast Experience
 *
 * Manages projects, sample data, and first forecast experiences
 * for customer onboarding.
 */

import { getDb, generateId } from '../firestore/client.js';
import {
  COLLECTIONS,
  type Project,
  type OnboardingProgress,
  type OnboardingStep,
  type Metric,
  type TimeSeriesDocument,
  type TimeSeriesPoint,
  type Forecast,
  type ForecastPoint,
} from '../firestore/schema.js';

// =============================================================================
// Types
// =============================================================================

export interface CreateProjectParams {
  orgId: string;
  name: string;
  description?: string;
}

export interface SampleDataResult {
  metricId: string;
  metricName: string;
  pointsLoaded: number;
}

export interface FirstForecastResult {
  forecastId: string;
  metricId: string;
  predictions: ForecastPoint[];
  inputPointsCount: number;
  outputPointsCount: number;
}

// =============================================================================
// Project Operations
// =============================================================================

/**
 * Create a new project
 */
export async function createProject(
  params: CreateProjectParams
): Promise<Project> {
  const db = getDb();
  const projectId = generateId('proj');
  const now = new Date();

  const project: Project = {
    id: projectId,
    orgId: params.orgId,
    name: params.name,
    description: params.description,
    status: 'active',
    sampleDataLoaded: false,
    firstForecastCompleted: false,
    createdAt: now,
    updatedAt: now,
  };

  await db
    .collection(COLLECTIONS.projects(params.orgId))
    .doc(projectId)
    .set(project);

  console.log(`[ProjectService] Created project: ${projectId} for org: ${params.orgId}`);

  return project;
}

/**
 * Get project by ID
 */
export async function getProjectById(
  orgId: string,
  projectId: string
): Promise<Project | null> {
  const db = getDb();
  const doc = await db
    .collection(COLLECTIONS.projects(orgId))
    .doc(projectId)
    .get();

  if (!doc.exists) {
    return null;
  }

  return doc.data() as Project;
}

/**
 * Get all projects for an organization
 */
export async function getProjects(orgId: string): Promise<Project[]> {
  const db = getDb();
  const snapshot = await db
    .collection(COLLECTIONS.projects(orgId))
    .where('status', '==', 'active')
    .orderBy('createdAt', 'desc')
    .get();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return snapshot.docs.map((doc: any) => doc.data() as Project);
}

/**
 * Update project
 */
export async function updateProject(
  orgId: string,
  projectId: string,
  updates: Partial<Project>
): Promise<Project | null> {
  const db = getDb();
  const docRef = db.collection(COLLECTIONS.projects(orgId)).doc(projectId);

  const doc = await docRef.get();
  if (!doc.exists) {
    return null;
  }

  const updateData = {
    ...updates,
    updatedAt: new Date(),
  };

  await docRef.update(updateData);

  const updated = await docRef.get();
  return updated.data() as Project;
}

// =============================================================================
// Sample Data Operations
// =============================================================================

/**
 * Generate sample MRR time series data
 */
function generateSampleMRRData(months = 12): TimeSeriesPoint[] {
  const points: TimeSeriesPoint[] = [];
  const now = new Date();

  // Start from 12 months ago
  const startDate = new Date(now);
  startDate.setMonth(startDate.getMonth() - months);

  // Generate realistic MRR growth with some variance
  let mrr = 10000; // Start at $10k MRR
  const growthRate = 0.12; // 12% monthly growth on average

  for (let i = 0; i < months; i++) {
    const date = new Date(startDate);
    date.setMonth(date.getMonth() + i);

    // Add some random variance (+/- 5%)
    const variance = 1 + ((Math.random() - 0.5) * 0.1);
    const growth = 1 + (growthRate * variance);
    mrr = mrr * growth;

    points.push({
      timestamp: date,
      value: Math.round(mrr),
      metadata: {
        generated: true,
        sample: true,
      },
    });
  }

  return points;
}

/**
 * Load sample data for a project
 */
export async function attachSampleSource(
  orgId: string,
  projectId: string
): Promise<SampleDataResult> {
  const db = getDb();

  // Verify project exists
  const project = await getProjectById(orgId, projectId);
  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }

  // Create sample metric
  const metricId = generateId('metric');
  const metricName = 'sample_mrr';
  const now = new Date();

  const metric: Metric = {
    id: metricId,
    orgId,
    name: metricName,
    displayName: 'Monthly Recurring Revenue (Sample)',
    description: 'Sample MRR data for demonstration',
    unit: 'USD',
    tags: { sample: 'true', project: projectId },
    createdAt: now,
    updatedAt: now,
    active: true,
  };

  // Save metric
  await db.collection(COLLECTIONS.metrics(orgId)).doc(metricId).set(metric);

  // Generate and save sample data
  const points = generateSampleMRRData(12);

  const tsDoc: TimeSeriesDocument = {
    id: generateId('ts'),
    orgId,
    metricId,
    metricName,
    startTime: points[0].timestamp,
    endTime: points[points.length - 1].timestamp,
    points,
    pointCount: points.length,
    createdAt: now,
  };

  await db
    .collection(COLLECTIONS.timeseries(orgId))
    .doc(tsDoc.id)
    .set(tsDoc);

  // Update project to mark sample data loaded
  await updateProject(orgId, projectId, {
    sampleDataLoaded: true,
  });

  console.log(`[ProjectService] Loaded ${points.length} sample points for project ${projectId}`);

  return {
    metricId,
    metricName,
    pointsLoaded: points.length,
  };
}

/**
 * Run first forecast for a project
 */
export async function runFirstForecast(
  orgId: string,
  projectId: string
): Promise<FirstForecastResult> {
  const db = getDb();

  // Verify project exists and has sample data
  const project = await getProjectById(orgId, projectId);
  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }

  if (!project.sampleDataLoaded) {
    throw new Error('Sample data must be loaded before running forecast');
  }

  // Get the sample metric
  const metricsSnapshot = await db
    .collection(COLLECTIONS.metrics(orgId))
    .where('tags.project', '==', projectId)
    .limit(1)
    .get();

  if (metricsSnapshot.empty) {
    throw new Error('No sample metric found for project');
  }

  const metric = metricsSnapshot.docs[0].data() as Metric;

  // Get time series data
  const tsSnapshot = await db
    .collection(COLLECTIONS.timeseries(orgId))
    .where('metricId', '==', metric.id)
    .limit(1)
    .get();

  if (tsSnapshot.empty) {
    throw new Error('No time series data found');
  }

  const tsDoc = tsSnapshot.docs[0].data() as TimeSeriesDocument;
  const historicalPoints = tsDoc.points;

  // Generate simple forecast using linear trend
  const forecastHorizon = 3; // 3 months ahead
  const predictions = generateSimpleForecast(historicalPoints, forecastHorizon);

  // Save forecast
  const forecastId = generateId('forecast');
  const now = new Date();

  const forecast: Forecast = {
    id: forecastId,
    orgId,
    metricId: metric.id,
    metricName: metric.name,
    horizonDays: forecastHorizon * 30, // Convert months to days
    backend: 'statistical',
    status: 'completed',
    predictions,
    modelInfo: {
      name: 'Linear Trend',
      version: '1.0',
      parameters: {
        method: 'simple_linear',
        inputPoints: historicalPoints.length,
      },
    },
    metrics: {
      inputPoints: historicalPoints.length,
      outputPoints: predictions.length,
      durationMs: 100,
    },
    createdAt: now,
    completedAt: now,
  };

  await db
    .collection(COLLECTIONS.forecasts(orgId))
    .doc(forecastId)
    .set(forecast);

  // Update project to mark first forecast completed
  await updateProject(orgId, projectId, {
    firstForecastCompleted: true,
    firstForecastId: forecastId,
  });

  console.log(`[ProjectService] Generated first forecast ${forecastId} for project ${projectId}`);

  return {
    forecastId,
    metricId: metric.id,
    predictions,
    inputPointsCount: historicalPoints.length,
    outputPointsCount: predictions.length,
  };
}

/**
 * Generate simple linear forecast
 */
function generateSimpleForecast(
  historicalPoints: TimeSeriesPoint[],
  horizonMonths: number
): ForecastPoint[] {
  if (historicalPoints.length < 2) {
    throw new Error('Need at least 2 historical points for forecast');
  }

  // Calculate linear trend from last 6 points
  const recentPoints = historicalPoints.slice(-6);
  const n = recentPoints.length;

  // Simple linear regression
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;

  recentPoints.forEach((point, i) => {
    const x = i;
    const y = point.value;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
  });

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // Generate forecast points
  const predictions: ForecastPoint[] = [];
  const lastTimestamp = historicalPoints[historicalPoints.length - 1].timestamp;

  for (let i = 1; i <= horizonMonths; i++) {
    const futureDate = new Date(lastTimestamp);
    futureDate.setMonth(futureDate.getMonth() + i);

    // Predict using trend
    const x = n + i - 1;
    const predictedValue = slope * x + intercept;

    // Add confidence interval (±15% for demo)
    const confidence = predictedValue * 0.15;

    predictions.push({
      timestamp: futureDate,
      predictedValue: Math.round(predictedValue),
      confidenceLower: Math.round(predictedValue - confidence),
      confidenceUpper: Math.round(predictedValue + confidence),
      confidenceLevel: 0.95,
    });
  }

  return predictions;
}

// =============================================================================
// Onboarding Progress Operations
// =============================================================================

/**
 * Initialize onboarding progress for an organization
 */
export async function initializeOnboarding(
  orgId: string
): Promise<OnboardingProgress> {
  const db = getDb();
  const progressId = generateId('onboard');
  const now = new Date();

  const progress: OnboardingProgress = {
    id: progressId,
    orgId,
    currentStep: 'org_setup',
    completedSteps: [],
    startedAt: now,
    updatedAt: now,
  };

  await db
    .collection(COLLECTIONS.onboardingProgress(orgId))
    .doc(progressId)
    .set(progress);

  console.log(`[ProjectService] Initialized onboarding for org: ${orgId}`);

  return progress;
}

/**
 * Update onboarding progress
 */
export async function updateOnboardingProgress(
  orgId: string,
  progressId: string,
  currentStep: OnboardingStep,
  projectId?: string
): Promise<OnboardingProgress | null> {
  const db = getDb();
  const docRef = db
    .collection(COLLECTIONS.onboardingProgress(orgId))
    .doc(progressId);

  const doc = await docRef.get();
  if (!doc.exists) {
    return null;
  }

  const current = doc.data() as OnboardingProgress;
  const completedSteps = [...current.completedSteps];

  // Add previous step to completed if not already there
  if (current.currentStep && !completedSteps.includes(current.currentStep)) {
    completedSteps.push(current.currentStep);
  }

  const updateData: Partial<OnboardingProgress> = {
    currentStep,
    completedSteps,
    updatedAt: new Date(),
  };

  if (projectId) {
    updateData.projectId = projectId;
  }

  if (currentStep === 'completed') {
    updateData.completedAt = new Date();
  }

  await docRef.update(updateData);

  const updated = await docRef.get();
  return updated.data() as OnboardingProgress;
}

/**
 * Get onboarding progress for an organization
 */
export async function getOnboardingProgress(
  orgId: string
): Promise<OnboardingProgress | null> {
  const db = getDb();
  const snapshot = await db
    .collection(COLLECTIONS.onboardingProgress(orgId))
    .orderBy('startedAt', 'desc')
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  return snapshot.docs[0].data() as OnboardingProgress;
}
