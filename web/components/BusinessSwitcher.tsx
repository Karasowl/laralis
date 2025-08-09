'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ApiResponse, Clinic } from '@/lib/types';

export function BusinessSwitcher() {
  const t = useTranslations('common');
  const router = useRouter();
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [selectedClinicId, setSelectedClinicId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchClinics();
  }, []);

  const fetchClinics = async () => {
    try {
      const response = await fetch('/api/clinics');
      const result: ApiResponse<Clinic[]> = await response.json();
      
      if (result.data) {
        setClinics(result.data);
        
        // Get current clinic from cookie or use first one
        const currentClinicId = getCookieValue('clinicId') || result.data[0]?.id || '';
        setSelectedClinicId(currentClinicId);
      }
    } catch (error) {
      console.error('Failed to fetch clinics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getCookieValue = (name: string): string | null => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
      return parts.pop()?.split(';').shift() || null;
    }
    return null;
  };

  const handleClinicChange = async (clinicId: string) => {
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
  };

  if (isLoading) {
    return (
      <div className="w-[200px] h-10 bg-gray-100 rounded-md animate-pulse" />
    );
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