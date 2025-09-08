/**
 * Advanced Analytics and Predictions Library
 * Provides mathematical analysis and predictions for dental clinic data
 */

export interface TreatmentData {
  id: string;
  treatment_date: string;
  price_cents: number;
  margin_pct: number;
  service_id: string;
  patient_id: string;
  created_at: string;
}

export interface PatientData {
  id: string;
  created_at: string;
  first_visit_date?: string;
  source?: string;
  age?: number;
  total_spent_cents?: number;
  total_treatments?: number;
}

export interface PredictionResult {
  trend: 'increasing' | 'decreasing' | 'stable';
  confidence: number; // 0-1
  predictedValue: number;
  confidence_interval: [number, number];
  seasonality?: {
    pattern: 'seasonal' | 'monthly' | 'weekly';
    peak_periods: string[];
  };
}

export interface BusinessInsights {
  revenue_predictions: {
    next_month: PredictionResult;
    next_quarter: PredictionResult;
    year_end: PredictionResult;
  };
  patient_insights: {
    acquisition_rate: number;
    retention_rate: number;
    lifetime_value: number;
    churn_risk: PatientData[];
  };
  service_analysis: {
    most_profitable: Array<{ service_id: string; roi: number; frequency: number }>;
    growth_opportunities: Array<{ service_id: string; potential_revenue: number }>;
    declining_services: Array<{ service_id: string; decline_rate: number }>;
  };
  operational_metrics: {
    capacity_utilization: number;
    optimal_pricing: Array<{ service_id: string; suggested_price: number; rationale: string }>;
    seasonal_patterns: Array<{ period: string; adjustment_factor: number }>;
  };
}

/**
 * Linear regression for trend analysis
 */
function linearRegression(x: number[], y: number[]): { slope: number; intercept: number; r2: number } {
  const n = x.length;
  if (n !== y.length || n < 2) throw new Error('Invalid data for regression');

  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0);
  const sumXX = x.reduce((acc, xi) => acc + xi * xi, 0);
  const sumYY = y.reduce((acc, yi) => acc + yi * yi, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  
  // Calculate R-squared
  const yMean = sumY / n;
  const ssTotal = y.reduce((acc, yi) => acc + Math.pow(yi - yMean, 2), 0);
  const ssRes = y.reduce((acc, yi, i) => acc + Math.pow(yi - (slope * x[i] + intercept), 2), 0);
  const r2 = 1 - (ssRes / ssTotal);

  return { slope, intercept, r2 };
}

/**
 * Moving average for smoothing data
 */
function movingAverage(data: number[], window: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - window + 1);
    const slice = data.slice(start, i + 1);
    const avg = slice.reduce((a, b) => a + b, 0) / slice.length;
    result.push(avg);
  }
  return result;
}

/**
 * Detect seasonality patterns
 */
function detectSeasonality(data: { date: Date; value: number }[]): {
  pattern: 'seasonal' | 'monthly' | 'weekly' | 'none';
  strength: number;
  peak_periods: string[];
} {
  if (data.length < 12) return { pattern: 'none', strength: 0, peak_periods: [] };

  // Group by month
  const monthlyData: { [key: number]: number[] } = {};
  data.forEach(d => {
    const month = d.date.getMonth();
    if (!monthlyData[month]) monthlyData[month] = [];
    monthlyData[month].push(d.value);
  });

  // Calculate average for each month
  const monthlyAvgs = Object.entries(monthlyData).map(([month, values]) => ({
    month: parseInt(month),
    avg: values.reduce((a, b) => a + b, 0) / values.length
  }));

  // Calculate coefficient of variation
  const values = monthlyAvgs.map(m => m.avg);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
  const cv = Math.sqrt(variance) / mean;

  const strength = Math.min(cv * 2, 1); // Normalize to 0-1

  // Find peak periods
  const maxAvg = Math.max(...values);
  const peakThreshold = maxAvg * 0.9; // Top 10%
  const peakMonths = monthlyAvgs
    .filter(m => m.avg >= peakThreshold)
    .map(m => new Date(0, m.month).toLocaleString('es', { month: 'long' }));

  return {
    pattern: strength > 0.3 ? 'seasonal' : strength > 0.15 ? 'monthly' : 'none',
    strength,
    peak_periods: peakMonths
  };
}

/**
 * Predict future revenue based on historical data
 */
export function predictRevenue(treatments: TreatmentData[], periodsAhead: number = 1): PredictionResult {
  // Group by month
  const monthlyRevenue: { [key: string]: number } = {};
  
  treatments.forEach(t => {
    const date = new Date(t.treatment_date);
    const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
    monthlyRevenue[monthKey] = (monthlyRevenue[monthKey] || 0) + t.price_cents;
  });

  const sortedMonths = Object.keys(monthlyRevenue).sort();
  const revenues = sortedMonths.map(month => monthlyRevenue[month]);
  
  if (revenues.length < 3) {
    return {
      trend: 'stable',
      confidence: 0.3,
      predictedValue: revenues[revenues.length - 1] || 0,
      confidence_interval: [0, revenues[revenues.length - 1] * 1.5 || 0]
    };
  }

  // Use linear regression
  const x = revenues.map((_, i) => i);
  const { slope, intercept, r2 } = linearRegression(x, revenues);
  
  const predictedValue = slope * (revenues.length + periodsAhead - 1) + intercept;
  const trend = slope > 0.05 ? 'increasing' : slope < -0.05 ? 'decreasing' : 'stable';
  
  // Calculate confidence interval based on R²
  const stdError = Math.sqrt(revenues.reduce((acc, val, i) => {
    const predicted = slope * i + intercept;
    return acc + Math.pow(val - predicted, 2);
  }, 0) / (revenues.length - 2));
  
  const marginOfError = stdError * 1.96; // 95% confidence
  
  return {
    trend,
    confidence: Math.max(0.1, r2),
    predictedValue: Math.max(0, predictedValue),
    confidence_interval: [
      Math.max(0, predictedValue - marginOfError),
      predictedValue + marginOfError
    ]
  };
}

/**
 * Calculate patient lifetime value
 */
export function calculatePatientLTV(patients: PatientData[], treatments: TreatmentData[]): number {
  if (patients.length === 0) return 0;

  // Calculate average revenue per patient
  const patientRevenue: { [key: string]: number } = {};
  const patientTreatmentCount: { [key: string]: number } = {};
  
  treatments.forEach(t => {
    patientRevenue[t.patient_id] = (patientRevenue[t.patient_id] || 0) + t.price_cents;
    patientTreatmentCount[t.patient_id] = (patientTreatmentCount[t.patient_id] || 0) + 1;
  });

  const revenues = Object.values(patientRevenue);
  const avgRevenue = revenues.length > 0 ? revenues.reduce((a, b) => a + b, 0) / revenues.length : 0;
  
  // Calculate average treatment frequency per year
  const treatmentCounts = Object.values(patientTreatmentCount);
  const avgTreatmentsPerPatient = treatmentCounts.length > 0 
    ? treatmentCounts.reduce((a, b) => a + b, 0) / treatmentCounts.length 
    : 0;

  // Estimate retention rate (simplified)
  const retentionRate = 0.7; // Can be calculated from actual data
  const avgPatientLifespanYears = 1 / (1 - retentionRate); // 3.33 years average

  return avgRevenue * avgPatientLifespanYears;
}

/**
 * Analyze service profitability and growth opportunities
 */
export function analyzeServices(treatments: TreatmentData[]): {
  most_profitable: Array<{ service_id: string; roi: number; frequency: number }>;
  growth_opportunities: Array<{ service_id: string; potential_revenue: number }>;
  declining_services: Array<{ service_id: string; decline_rate: number }>;
} {
  if (treatments.length === 0) {
    return { most_profitable: [], growth_opportunities: [], declining_services: [] };
  }

  // Group by service
  const serviceData: { [key: string]: { revenues: number[]; margins: number[]; dates: Date[] } } = {};
  
  treatments.forEach(t => {
    if (!serviceData[t.service_id]) {
      serviceData[t.service_id] = { revenues: [], margins: [], dates: [] };
    }
    serviceData[t.service_id].revenues.push(t.price_cents);
    serviceData[t.service_id].margins.push(t.margin_pct);
    serviceData[t.service_id].dates.push(new Date(t.treatment_date));
  });

  // Calculate profitability
  const most_profitable = Object.entries(serviceData)
    .map(([serviceId, data]) => ({
      service_id: serviceId,
      roi: data.margins.reduce((a, b) => a + b, 0) / data.margins.length,
      frequency: data.revenues.length
    }))
    .sort((a, b) => b.roi - a.roi)
    .slice(0, 5);

  // Identify growth opportunities (high margin, low frequency)
  const growth_opportunities = Object.entries(serviceData)
    .map(([serviceId, data]) => {
      const avgMargin = data.margins.reduce((a, b) => a + b, 0) / data.margins.length;
      const avgRevenue = data.revenues.reduce((a, b) => a + b, 0) / data.revenues.length;
      return {
        service_id: serviceId,
        potential_revenue: avgRevenue * avgMargin * 0.01 * (100 - data.revenues.length) // Simplified calculation
      };
    })
    .filter(s => s.potential_revenue > 0)
    .sort((a, b) => b.potential_revenue - a.potential_revenue)
    .slice(0, 3);

  // Detect declining services
  const declining_services = Object.entries(serviceData)
    .map(([serviceId, data]) => {
      if (data.dates.length < 4) return null;
      
      // Group by month and calculate trend
      const monthlyCount: { [key: string]: number } = {};
      data.dates.forEach(date => {
        const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
        monthlyCount[monthKey] = (monthlyCount[monthKey] || 0) + 1;
      });
      
      const counts = Object.values(monthlyCount);
      if (counts.length < 3) return null;
      
      const x = counts.map((_, i) => i);
      try {
        const { slope } = linearRegression(x, counts);
        return slope < -0.1 ? { service_id: serviceId, decline_rate: Math.abs(slope) } : null;
      } catch {
        return null;
      }
    })
    .filter(s => s !== null)
    .sort((a, b) => b!.decline_rate - a!.decline_rate)
    .slice(0, 3) as Array<{ service_id: string; decline_rate: number }>;

  return {
    most_profitable,
    growth_opportunities,
    declining_services
  };
}

/**
 * Generate comprehensive business insights
 */
export function generateBusinessInsights(
  treatments: TreatmentData[],
  patients: PatientData[]
): BusinessInsights {
  return {
    revenue_predictions: {
      next_month: predictRevenue(treatments, 1),
      next_quarter: predictRevenue(treatments, 3),
      year_end: predictRevenue(treatments, 12)
    },
    patient_insights: {
      acquisition_rate: patients.length, // Simplified
      retention_rate: 0.7, // Would calculate from actual data
      lifetime_value: calculatePatientLTV(patients, treatments),
      churn_risk: [] // Would identify patients at risk
    },
    service_analysis: analyzeServices(treatments),
    operational_metrics: {
      capacity_utilization: 0.75, // Would calculate from appointment data
      optimal_pricing: [], // Would require cost analysis
      seasonal_patterns: [] // Would calculate from historical data
    }
  };
}

/**
 * Calculate key performance indicators
 */
export function calculateKPIs(treatments: TreatmentData[], patients: PatientData[]) {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  // Recent treatments
  const recentTreatments = treatments.filter(t => new Date(t.treatment_date) >= thirtyDaysAgo);
  
  // Revenue metrics
  const totalRevenue = recentTreatments.reduce((sum, t) => sum + t.price_cents, 0);
  const avgTreatmentValue = recentTreatments.length > 0 ? totalRevenue / recentTreatments.length : 0;
  
  // Patient metrics
  const recentPatients = patients.filter(p => new Date(p.created_at) >= thirtyDaysAgo);
  const avgPatientsPerDay = recentPatients.length / 30;
  
  // Profitability
  const avgMargin = recentTreatments.length > 0 
    ? recentTreatments.reduce((sum, t) => sum + (t.margin_pct || 0), 0) / recentTreatments.length
    : 0;

  return {
    totalRevenue,
    avgTreatmentValue,
    treatmentCount: recentTreatments.length,
    newPatients: recentPatients.length,
    avgPatientsPerDay,
    avgMargin,
    revenueGrowth: 0, // Would calculate from historical comparison
    patientGrowth: 0  // Would calculate from historical comparison
  };
}