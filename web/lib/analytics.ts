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
    const k = 'laralis-session-id';
    let v = sessionStorage.getItem(k);
    if (!v) {
      v = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
      sessionStorage.setItem(k, v);
    }
    return v;
  } catch {
    return 'unknown';
  }
}

function getClinicIdFromCookie(): string | undefined {
  try {
    const m = document.cookie.match(/(?:^|; )clinicId=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : undefined;
  } catch { return undefined }
}

export function track(base: Partial<AnalyticsPayload> & { event: AnalyticsEventName }): void {
  const payload: AnalyticsPayload = {
    event: base.event,
    actionId: base.actionId,
    clinicId: base.clinicId || getClinicIdFromCookie(),
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
    const ok = (navigator as any).sendBeacon && (navigator as any).sendBeacon('/api/analytics', blob);
    if (!ok) {
      // Dev fallback
      fetch('/api/analytics', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), keepalive: true });
    }
    if (process.env.NEXT_PUBLIC_REQUIREMENTS_DEBUG === '1') {
      // eslint-disable-next-line no-console
      console.debug('[analytics]', payload);
    }
  } catch {
    // ignore
  }
}

