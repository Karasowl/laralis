/**
 * Setup para Vitest - Configuración global de pruebas
 */
import { beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Configurar variables de entorno para tests
beforeAll(() => {
  // NODE_ENV is already set by Vitest
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
});

// Limpiar después de cada test
beforeEach(() => {
  cleanup();
});

// Mock de Supabase para tests unitarios
const mockSupabaseClient = {
  auth: {
    getUser: vi.fn(),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    onAuthStateChange: vi.fn(() => ({
      data: { subscription: { unsubscribe: vi.fn() } }
    }))
  },
  from: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn(),
    then: vi.fn()
  }))
};

// Mock de createSupabaseClient para tests
vi.mock('@/lib/supabase', () => ({
  createSupabaseClient: () => mockSupabaseClient
}));

vi.mock('@/lib/supabaseAdmin', () => ({
  supabaseAdmin: mockSupabaseClient
}));

// Mock de next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    pathname: '/test',
    query: {},
  }),
  usePathname: () => '/test',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock de next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'es',
}));

export { mockSupabaseClient };
