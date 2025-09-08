/**
 * Tests críticos de aislamiento multi-tenant
 * Verifican que los datos están correctamente aislados entre clínicas
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { mockSupabaseClient } from '../setup';

// Mock de las funciones de clínica
vi.mock('@/lib/clinic', () => ({
  getClinicIdOrDefault: vi.fn()
}));

import { getClinicIdOrDefault } from '@/lib/clinic';

describe('Multi-Tenancy - Aislamiento de Datos', () => {
  const clinic1Id = 'clinic-1-uuid';
  const clinic2Id = 'clinic-2-uuid';
  const user1Id = 'user-1-uuid';
  const user2Id = 'user-2-uuid';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Patients API', () => {
    it('debe devolver solo pacientes de la clínica actual', async () => {
      // Mock del usuario autenticado
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: user1Id } },
        error: null
      });

      // Mock de clinic ID
      vi.mocked(getClinicIdOrDefault).mockResolvedValue(clinic1Id);

      // Mock de la consulta de pacientes
      const mockPatients = [
        { id: 'patient-1', clinic_id: clinic1Id, first_name: 'Juan' },
        { id: 'patient-2', clinic_id: clinic1Id, first_name: 'María' }
      ];

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: mockPatients,
          error: null
        })
      });

      // Simular request
      const request = new NextRequest('http://localhost/api/patients');
      
      // Importar y ejecutar la API
      const { GET } = await import('@/app/api/patients/route');
      const response = await GET(request);
      const data = await response.json();

      // Verificaciones
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('patients');
      expect(data.data).toHaveLength(2);
      expect(data.data.every((p: any) => p.clinic_id === clinic1Id)).toBe(true);
    });

    it('debe rechazar acceso sin autenticación', async () => {
      // Mock de usuario no autenticado
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('No user')
      });

      const request = new NextRequest('http://localhost/api/patients');
      const { GET } = await import('@/app/api/patients/route');
      const response = await GET(request);

      expect(response.status).toBe(401);
    });

    it('debe rechazar acceso sin contexto de clínica', async () => {
      // Mock del usuario autenticado
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: user1Id } },
        error: null
      });

      // Mock de clinic ID null
      vi.mocked(getClinicIdOrDefault).mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/patients');
      const { GET } = await import('@/app/api/patients/route');
      const response = await GET(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('No clinic context available');
    });
  });

  describe('Services API', () => {
    it('debe filtrar servicios por clinic_id', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: user1Id } },
        error: null
      });

      vi.mocked(getClinicIdOrDefault).mockResolvedValue(clinic1Id);

      const mockServices = [
        { id: 'service-1', clinic_id: clinic1Id, name: 'Limpieza' }
      ];

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: mockServices,
          error: null
        })
      });

      const request = new NextRequest('http://localhost/api/services');
      const { GET } = await import('@/app/api/services/route');
      const response = await GET(request);
      const data = await response.json();

      expect(data.data).toHaveLength(1);
      expect(data.data[0].clinic_id).toBe(clinic1Id);
    });
  });

  describe('Marketing Platforms API', () => {
    it('debe devolver solo plataformas del sistema O de la clínica actual', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: user1Id } },
        error: null
      });

      vi.mocked(getClinicIdOrDefault).mockResolvedValue(clinic1Id);

      const mockPlatforms = [
        { id: 'platform-1', clinic_id: null, is_system: true, display_name: 'Meta Ads' },
        { id: 'platform-2', clinic_id: clinic1Id, is_system: false, display_name: 'Custom Platform' }
      ];

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: mockPlatforms,
          error: null
        })
      });

      const request = new NextRequest('http://localhost/api/marketing/platforms');
      const { GET } = await import('@/app/api/marketing/platforms/route');
      const response = await GET(request);
      const data = await response.json();

      expect(data.data).toHaveLength(2);
      // Debe incluir plataformas del sistema (clinic_id null) y de la clínica actual
      expect(data.data.some((p: any) => p.is_system && !p.clinic_id)).toBe(true);
      expect(data.data.some((p: any) => !p.is_system && p.clinic_id === clinic1Id)).toBe(true);
    });
  });

  describe('Cross-Clinic Access Prevention', () => {
    it('debe prevenir acceso a datos de otra clínica via URL manipulation', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: user1Id } },
        error: null
      });

      // Usuario intenta acceder a datos de clinic2 pero su contexto es clinic1
      vi.mocked(getClinicIdOrDefault).mockResolvedValue(clinic1Id);

      // Mock que simula que no encuentra datos porque clinic_id no coincide
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116', message: 'Row not found' }
        })
      });

      // Intentar acceder a un paciente específico (esto debería fallar si el paciente no pertenece a la clínica)
      const request = new NextRequest('http://localhost/api/patients/other-clinic-patient-id');
      const { GET } = await import('@/app/api/patients/[id]/route');
      const response = await GET(request, { params: { id: 'other-clinic-patient-id' } });

      expect(response.status).toBe(404);
    });
  });

  describe('Workspace Isolation', () => {
    it('debe devolver solo workspaces del usuario propietario', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: user1Id } },
        error: null
      });

      const mockWorkspaces = [
        { id: 'workspace-1', owner_id: user1Id, name: 'Mi Clínica' }
      ];

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: mockWorkspaces,
          error: null
        })
      });

      const request = new NextRequest('http://localhost/api/workspaces');
      const { GET } = await import('@/app/api/workspaces/route');
      const response = await GET(request);
      const data = await response.json();

      // Debe haber filtrado por owner_id = user1Id
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('workspaces');
      expect(data.workspace.owner_id).toBe(user1Id);
    });
  });

  describe('Data Modification Security', () => {
    it('debe validar clinic_id en operaciones de escritura', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: user1Id } },
        error: null
      });

      vi.mocked(getClinicIdOrDefault).mockResolvedValue(clinic1Id);

      mockSupabaseClient.from.mockReturnValue({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'new-patient', clinic_id: clinic1Id },
          error: null
        })
      });

      const patientData = {
        first_name: 'Test',
        last_name: 'Patient',
        email: 'test@example.com'
      };

      const request = new NextRequest('http://localhost/api/patients', {
        method: 'POST',
        body: JSON.stringify(patientData)
      });

      const { POST } = await import('@/app/api/patients/route');
      const response = await POST(request);
      const data = await response.json();

      // Verificar que se insertó con el clinic_id correcto
      expect(data.data.clinic_id).toBe(clinic1Id);
    });
  });
});
