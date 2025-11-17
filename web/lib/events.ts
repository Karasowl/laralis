// Centralized event names and typed payloads

export const OnboardingEvents = {
  OpenSuppliesImporter: 'onboarding:open-supplies-importer',
  OpenRecipeWizard: 'onboarding:open-recipe-wizard',
} as const;

export type OnboardingEventName = typeof OnboardingEvents[keyof typeof OnboardingEvents];

export type OnboardingEventDetail = {
  source?: 'requirements-guard' | string;
  actionId?: 'create_service' | 'create_treatment' | string;
  clinicId: string;
  serviceId?: string;
  missing?: string[];
};

export type OnboardingEvent = {
  type: OnboardingEventName;
  detail: OnboardingEventDetail;
};

