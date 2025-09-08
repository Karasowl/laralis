'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Clinic } from '@/lib/types';
import { useApi } from '@/hooks/use-api';

export function BusinessSwitcher() {
  const t = useTranslations('common');
  const router = useRouter();
  const [selectedClinicId, setSelectedClinicId] = useState<string>('');
  
  // Use useApi hook for fetching clinics
  const { data: clinicsData, loading, error } = useApi<{ data: Clinic[] }>(
    '/api/clinics',
    { autoFetch: true }
  );
  
  const clinics = clinicsData?.data || [];

  // Set initial selected clinic
  useEffect(() => {
    if (clinics.length > 0 && !selectedClinicId) {
      // Get current clinic from cookie or use first one
      const currentClinicId = getCookieValue('clinicId') || clinics[0]?.id || '';
      setSelectedClinicId(currentClinicId);
    }
  }, [clinics, selectedClinicId]);

  const getCookieValue = (name: string): string | null => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
      return parts.pop()?.split(';').shift() || null;
    }
    return null;
  };

  const handleClinicChange = useCallback(async (clinicId: string) => {
    try {
      const response = await fetch('/api/clinics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ clinicId }),
      });

      if (response.ok) {
        setSelectedClinicId(clinicId);
        // Refresh the page to reload data with new clinic context
        router.refresh();
      }
    } catch (error) {
      console.error('Failed to switch clinic:', error);
    }
  }, [router]);

  if (loading) {
    return <Skeleton className="w-[200px] h-10" />;
  }

  if (clinics.length === 0) {
    return (
      <div className="text-sm text-gray-500">
        {t('noClinicsFound')}
      </div>
    );
  }

  return (
    <Select value={selectedClinicId} onValueChange={handleClinicChange}>
      <SelectTrigger className="w-[200px] bg-white">
        <SelectValue placeholder={t('selectClinic')} />
      </SelectTrigger>
      <SelectContent>
        {clinics.map((clinic) => (
          <SelectItem key={clinic.id} value={clinic.id}>
            {clinic.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}