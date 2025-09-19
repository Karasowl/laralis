// Lightweight analytics with sendBeacon fallback

export type AnalyticsEventName = 'guard.open' | 'autofix.triggered' | 'unblocked' | 'drawer.open' | 'drawer.apply';

export type AnalyticsPayload = {
  event: AnalyticsEventName;
  actionId?: string;
  clinicId?: string;
  serviceId?: string;
  missing?: string[];
  ts: number;
  href: string;
  sessionId: string;
  // Optional drawer context (kept non-PII):
  minutes?: number;
  costPerMinuteCents?: number;
  variableCostCents?: number;
  marginPct?: number;
  stepCents?: number;
  roundMode?: 'nearest' | 'up' | 'down';
  priceCents?: number;
  roundedCents?: number;
};

function getSessionId(): string {
  try {
    const key = 'laralis-session-id';
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
    const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
    sessionStorage.setItem(key, id);
    return id;
  } catch {
    return 'unknown';
  }
}

function getClinicIdFromCookie(): string | undefined {
  try {
    const match = document.cookie.match(/(?:^|; )clinicId=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : undefined;
  } catch {
    return undefined;
  }
}

export function track(base: Partial<AnalyticsPayload> & { event: AnalyticsEventName }): void {
  const payload: AnalyticsPayload = {
    event: base.event,
    actionId: base.actionId,
    clinicId: base.clinicId ?? getClinicIdFromCookie(),
    serviceId: base.serviceId,
    missing: base.missing,
    ts: Date.now(),
    href: typeof location !== 'undefined' ? location.pathname + location.search : '',
    sessionId: getSessionId(),
    minutes: base.minutes,
    costPerMinuteCents: base.costPerMinuteCents,
    variableCostCents: base.variableCostCents,
    marginPct: base.marginPct,
    stepCents: base.stepCents,
    roundMode: base.roundMode,
    priceCents: base.priceCents,
    roundedCents: base.roundedCents,
  };

  try {
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    if (typeof navigator !== 'undefined') {
      const navWithBeacon = navigator as Navigator & {
        sendBeacon?: (url: string | URL, data?: BodyInit | null) => boolean;
      };
      const beacon = typeof navWithBeacon.sendBeacon === 'function'
        ? navWithBeacon.sendBeacon.bind(navWithBeacon)
        : undefined;
      const delivered = beacon ? beacon('/api/analytics', blob) : false;
      if (!delivered) {
        void fetch('/api/analytics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: true,
        });
      }
    } else {
      void fetch('/api/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      });
    }

    if (process.env.NEXT_PUBLIC_REQUIREMENTS_DEBUG === '1') {
      // eslint-disable-next-line no-console
      console.debug('[analytics]', payload);
    }
  } catch {
    // ignore network errors – analytics should never block the UI
  }
}

export interface TreatmentData {
  id: string;
  service_id: string;
  patient_id: string;
  treatment_date: string;
  price_cents: number;
  variable_cost_cents: number;
  fixed_per_minute_cents: number;
  minutes: number;
  margin_pct: number;
  status: string;
}

export interface PatientData {
  id: string;
  first_name: string;
  last_name: string;
  created_at: string;
}

export interface RevenuePrediction {
  predictedValue: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  confidence: number;
  confidence_interval: [number, number];
}

export interface ServicePerformance {
  service_id: string;
  frequency: number;
  roi: number;
  average_margin: number;
}

export interface ServiceGrowthOpportunity {
  service_id: string;
  potential_revenue: number;
  frequency: number;
  average_margin: number;
}

export interface DecliningService {
  service_id: string;
  decline_rate: number;
  frequency: number;
}

export interface PatientInsights {
  lifetime_value: number;
  retention_rate: number;
  acquisition_rate: number;
}

export interface OperationalMetrics {
  capacity_utilization: number;
  average_minutes_per_day: number;
}

export interface BusinessInsights {
  revenue_predictions: {
    next_month: RevenuePrediction;
    next_quarter: RevenuePrediction;
    year_end: RevenuePrediction;
  };
  service_analysis: {
    most_profitable: ServicePerformance[];
    growth_opportunities: ServiceGrowthOpportunity[];
    declining_services: DecliningService[];
  };
  patient_insights: PatientInsights;
  operational_metrics: OperationalMetrics;
}

function toMonthKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}`;
}

function normaliseDate(value: string): Date {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
}

function clampPercentage(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function emptyPrediction(): RevenuePrediction {
  return {
    predictedValue: 0,
    trend: 'stable',
    confidence: 0.5,
    confidence_interval: [0, 0],
  };
}

function calculateRevenuePredictions(treatments: TreatmentData[]): BusinessInsights['revenue_predictions'] {
  if (!treatments.length) {
    return {
      next_month: emptyPrediction(),
      next_quarter: emptyPrediction(),
      year_end: emptyPrediction(),
    };
  }

  const monthly = new Map<string, { revenue: number; count: number }>();
  for (const treatment of treatments) {
    if (!treatment.treatment_date || treatment.price_cents <= 0) continue;
    const date = normaliseDate(treatment.treatment_date);
    const key = toMonthKey(date);
    const current = monthly.get(key) ?? { revenue: 0, count: 0 };
    current.revenue += treatment.price_cents;
    current.count += 1;
    monthly.set(key, current);
  }

  const ordered = Array.from(monthly.entries())
    .map(([key, stats]) => ({ key, ...stats, date: new Date(`${key}-01`) }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const latest = ordered.at(-1);
  const previous = ordered.at(-2);
  const trend = (() => {
    if (!latest || !previous) return 'stable' as const;
    if (latest.revenue > previous.revenue * 1.05) return 'increasing' as const;
    if (latest.revenue < previous.revenue * 0.95) return 'decreasing' as const;
    return 'stable' as const;
  })();

  const latestRevenue = latest?.revenue ?? 0;
  const previousRevenue = previous?.revenue ?? latestRevenue;
  const avgRevenue = ordered.reduce((sum, row) => sum + row.revenue, 0) / Math.max(1, ordered.length);
  const totalCount = ordered.reduce((sum, row) => sum + row.count, 0);
  const confidence = clampPercentage(0.4 + Math.min(totalCount, 50) / 100);
  const baseInterval = Math.round(latestRevenue * 0.15);
  const nextMonthPrediction: RevenuePrediction = {
    predictedValue: Math.round(latestRevenue || avgRevenue),
    trend,
    confidence,
    confidence_interval: [
      Math.max(0, Math.round((latestRevenue || avgRevenue) - baseInterval)),
      Math.round((latestRevenue || avgRevenue) + baseInterval),
    ],
  };

  const quarterlyRevenue = Math.round(avgRevenue * 3);
  const quarterlyInterval = Math.round(quarterlyRevenue * 0.2);
  const nextQuarterPrediction: RevenuePrediction = {
    predictedValue: quarterlyRevenue,
    trend,
    confidence: clampPercentage(confidence - 0.05),
    confidence_interval: [
      Math.max(0, quarterlyRevenue - quarterlyInterval),
      quarterlyRevenue + quarterlyInterval,
    ],
  };

  const currentMonth = latest?.date ?? new Date();
  const monthsLeft = 12 - (currentMonth.getMonth() + 1);
  const yearEndRevenue = Math.round((ordered.reduce((sum, row) => sum + row.revenue, 0) + avgRevenue * monthsLeft));
  const yearInterval = Math.round(yearEndRevenue * 0.1);
  const yearEndPrediction: RevenuePrediction = {
    predictedValue: yearEndRevenue,
    trend,
    confidence: clampPercentage(confidence - 0.1),
    confidence_interval: [
      Math.max(0, yearEndRevenue - yearInterval),
      yearEndRevenue + yearInterval,
    ],
  };

  return {
    next_month: nextMonthPrediction,
    next_quarter: nextQuarterPrediction,
    year_end: yearEndPrediction,
  };
}

function calculateServiceInsights(treatments: TreatmentData[]): BusinessInsights['service_analysis'] {
  const byService = new Map<string, {
    revenue: number;
    cost: number;
    profit: number;
    frequency: number;
    recent: number;
    previous: number;
    lastDate?: Date;
  }>();

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  for (const treatment of treatments) {
    const date = normaliseDate(treatment.treatment_date);
    const entry = byService.get(treatment.service_id) ?? {
      revenue: 0,
      cost: 0,
      profit: 0,
      frequency: 0,
      recent: 0,
      previous: 0,
      lastDate: undefined,
    };
    const price = treatment.price_cents || 0;
    const variable = treatment.variable_cost_cents || 0;
    const fixed = (treatment.fixed_per_minute_cents || 0) * (treatment.minutes || 0);
    const cost = variable + fixed;
    const profit = price - cost;
    entry.revenue += price;
    entry.cost += cost;
    entry.profit += profit;
    entry.frequency += 1;
    if (date >= thirtyDaysAgo) {
      entry.recent += 1;
    } else if (date >= sixtyDaysAgo) {
      entry.previous += 1;
    }
    entry.lastDate = entry.lastDate && entry.lastDate > date ? entry.lastDate : date;
    byService.set(treatment.service_id, entry);
  }

  const mostProfitable: ServicePerformance[] = Array.from(byService.entries())
    .map(([service_id, stats]) => {
      const roiBase = stats.cost <= 0 ? (stats.profit > 0 ? 1 : 0) : stats.profit / stats.cost;
      const roi = Math.round(roiBase * 1000) / 10;
      const averageMargin = stats.frequency ? Math.round((stats.profit / stats.frequency)) : 0;
      return { service_id, frequency: stats.frequency, roi, average_margin: averageMargin };
    })
    .sort((a, b) => b.roi - a.roi)
    .slice(0, 10);

  const growthOpportunities: ServiceGrowthOpportunity[] = Array.from(byService.entries())
    .filter(([, stats]) => stats.profit > 0)
    .map(([service_id, stats]) => ({
      service_id,
      potential_revenue: Math.max(0, Math.round((stats.profit / Math.max(1, stats.frequency)) * 5)),
      frequency: stats.frequency,
      average_margin: stats.frequency ? Math.round(stats.profit / stats.frequency) : 0,
    }))
    .sort((a, b) => b.average_margin - a.average_margin)
    .slice(0, 10);

  const decliningServices: DecliningService[] = Array.from(byService.entries())
    .filter(([, stats]) => stats.previous > 0 && stats.recent < stats.previous)
    .map(([service_id, stats]) => ({
      service_id,
      frequency: stats.recent,
      decline_rate: Math.max(-1, (stats.recent - stats.previous) / stats.previous),
    }))
    .sort((a, b) => a.decline_rate - b.decline_rate)
    .slice(0, 10);

  return {
    most_profitable: mostProfitable,
    growth_opportunities: growthOpportunities,
    declining_services: decliningServices,
  };
}

function calculatePatientInsights(treatments: TreatmentData[], patients: PatientData[]): PatientInsights {
  if (!patients.length) {
    return { lifetime_value: 0, retention_rate: 0, acquisition_rate: 0 };
  }

  const byPatient = new Map<string, { revenue: number; treatments: number; firstDate: Date }>();
  for (const treatment of treatments) {
    const entry = byPatient.get(treatment.patient_id) ?? { revenue: 0, treatments: 0, firstDate: normaliseDate(treatment.treatment_date) };
    entry.revenue += treatment.price_cents || 0;
    entry.treatments += 1;
    const treatmentDate = normaliseDate(treatment.treatment_date);
    if (treatmentDate < entry.firstDate) entry.firstDate = treatmentDate;
    byPatient.set(treatment.patient_id, entry);
  }

  const totalRevenue = Array.from(byPatient.values()).reduce((sum, patient) => sum + patient.revenue, 0);
  const lifetimeValue = Math.round(totalRevenue / Math.max(1, byPatient.size));

  const repeatPatients = Array.from(byPatient.values()).filter(patient => patient.treatments > 1).length;
  const retentionRate = clampPercentage(repeatPatients / Math.max(1, byPatient.size));

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  let newPatients = 0;
  for (const patient of byPatient.values()) {
    if (patient.firstDate >= thirtyDaysAgo) newPatients += 1;
  }
  const acquisitionRate = newPatients;

  return {
    lifetime_value: lifetimeValue,
    retention_rate: retentionRate,
    acquisition_rate: acquisitionRate,
  };
}

function calculateOperationalMetrics(treatments: TreatmentData[]): OperationalMetrics {
  if (!treatments.length) {
    return { capacity_utilization: 0, average_minutes_per_day: 0 };
  }
  const minutesByDay = new Map<string, number>();
  for (const treatment of treatments) {
    const date = normaliseDate(treatment.treatment_date);
    const key = date.toISOString().slice(0, 10);
    const current = minutesByDay.get(key) ?? 0;
    minutesByDay.set(key, current + (treatment.minutes || 0));
  }
  const totalMinutes = Array.from(minutesByDay.values()).reduce((sum, minutes) => sum + minutes, 0);
  const activeDays = Math.max(1, minutesByDay.size);
  const averageMinutesPerDay = totalMinutes / activeDays;
  const theoreticalCapacityPerDay = 8 * 60;
  const utilization = clampPercentage(averageMinutesPerDay / theoreticalCapacityPerDay);
  return {
    capacity_utilization: utilization,
    average_minutes_per_day: Math.round(averageMinutesPerDay),
  };
}

export function calculateKPIs(treatments: TreatmentData[], patients: PatientData[]): {
  avgTreatmentValue: number;
  avgMargin: number;
  avgPatientsPerDay: number;
  treatmentCount: number;
} {
  if (!treatments.length) {
    return { avgTreatmentValue: 0, avgMargin: 0, avgPatientsPerDay: 0, treatmentCount: 0 };
  }

  const completed = treatments.filter(treatment => treatment.status === 'completed');
  const totalRevenue = completed.reduce((sum, treatment) => sum + (treatment.price_cents || 0), 0);
  const totalMargin = completed.reduce((sum, treatment) => sum + (treatment.margin_pct || 0), 0);
  const treatmentCount = completed.length;
  const avgTreatmentValue = Math.round(totalRevenue / Math.max(1, treatmentCount));
  const avgMargin = treatmentCount ? totalMargin / treatmentCount : 0;

  const activeDays = new Set<string>();
  for (const treatment of completed) {
    const date = normaliseDate(treatment.treatment_date);
    activeDays.add(date.toISOString().slice(0, 10));
  }
  const uniquePatients = new Set(patients.map(patient => patient.id));
  const avgPatientsPerDay = activeDays.size ? uniquePatients.size / activeDays.size : uniquePatients.size;

  return {
    avgTreatmentValue,
    avgMargin,
    avgPatientsPerDay,
    treatmentCount,
  };
}

export function generateBusinessInsights(treatments: TreatmentData[], patients: PatientData[]): BusinessInsights {
  if (!treatments.length) {
    return {
      revenue_predictions: {
        next_month: emptyPrediction(),
        next_quarter: emptyPrediction(),
        year_end: emptyPrediction(),
      },
      service_analysis: {
        most_profitable: [],
        growth_opportunities: [],
        declining_services: [],
      },
      patient_insights: { lifetime_value: 0, retention_rate: 0, acquisition_rate: 0 },
      operational_metrics: { capacity_utilization: 0, average_minutes_per_day: 0 },
    };
  }

  const completedTreatments = treatments.filter(treatment => treatment.status === 'completed');

  return {
    revenue_predictions: calculateRevenuePredictions(completedTreatments),
    service_analysis: calculateServiceInsights(completedTreatments),
    patient_insights: calculatePatientInsights(completedTreatments, patients),
    operational_metrics: calculateOperationalMetrics(completedTreatments),
  };
}
