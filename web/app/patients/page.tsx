'use client';

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DataTable } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useTranslations } from 'next-intl';
import { Plus, Search, Edit, Trash2, Phone, Mail, Calendar, MapPin, Users, UserCheck, Megaphone } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { formatDate } from '@/lib/format';

const patientSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  birth_date: z.string().optional(),
  first_visit_date: z.string().optional(),
  gender: z.enum(['male', 'female', 'other', '']).optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  postal_code: z.string().optional(),
  notes: z.string().optional(),
  source_id: z.string().optional(),
  referred_by_patient_id: z.string().optional(),
  campaign_name: z.string().optional(),
  is_recurring: z.boolean().optional()
});

type PatientForm = z.infer<typeof patientSchema>;

interface Patient {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  birth_date?: string;
  first_visit_date?: string;
  gender?: string;
  address?: string;
  city?: string;
  postal_code?: string;
  notes?: string;
  source_id?: string;
  referred_by_patient_id?: string;
  campaign_name?: string;
  is_recurring?: boolean;
  created_at: string;
}

interface PatientSource {
  id: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  is_active: boolean;
  is_system: boolean;
}

export default function PatientsPage() {
  const t = useTranslations();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [patientSources, setPatientSources] = useState<PatientSource[]>([]);
  const [allPatients, setAllPatients] = useState<Patient[]>([]);
  
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<PatientForm>({
    resolver: zodResolver(patientSchema),
  });

  useEffect(() => {
    loadPatients();
    loadPatientSources();
  }, []);

  const loadPatients = async (search?: string) => {
    try {
      const url = search 
        ? `/api/patients?search=${encodeURIComponent(search)}`
        : '/api/patients';
      
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        console.log('Patients loaded:', data); // Debug
        const patientsArray = Array.isArray(data) ? data : (data.data || []);
        setPatients(patientsArray);
        if (!search) {
          setAllPatients(patientsArray); // Guardar todos los pacientes para el selector de referidos
        }
      }
    } catch (error) {
      console.error('Error loading patients:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPatientSources = async () => {
    try {
      const response = await fetch('/api/patient-sources?active=true');
      if (response.ok) {
        const data = await response.json();
        setPatientSources(data.data || []);
      }
    } catch (error) {
      console.error('Error loading patient sources:', error);
    }
  };

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    loadPatients(value);
  };

  const onSubmit = async (data: PatientForm) => {
    try {
      const url = editingPatient 
        ? `/api/patients/${editingPatient.id}`
        : '/api/patients';
      
      const method = editingPatient ? 'PUT' : 'POST';
      
      console.log('Submitting patient data:', data); // Debug
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      
      if (response.ok) {
        console.log('Patient saved successfully:', result);
        await loadPatients();
        reset();
        setIsCreateOpen(false);
        setEditingPatient(null);
      } else {
        console.error('Error response from server:', result);
        alert(result.message || 'Error al guardar paciente');
      }
    } catch (error) {
      console.error('Error saving patient:', error);
      alert('Error al guardar paciente');
    }
  };

  const handleEdit = (patient: Patient) => {
    setEditingPatient(patient);
    reset({
      first_name: patient.first_name,
      last_name: patient.last_name,
      email: patient.email || '',
      phone: patient.phone || '',
      birth_date: patient.birth_date || '',
      first_visit_date: patient.first_visit_date || '',
      gender: patient.gender as any || '',
      address: patient.address || '',
      city: patient.city || '',
      postal_code: patient.postal_code || '',
      notes: patient.notes || '',
      source_id: patient.source_id || '',
      referred_by_patient_id: patient.referred_by_patient_id || '',
      campaign_name: patient.campaign_name || '',
      is_recurring: patient.is_recurring || false
    });
    setIsCreateOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('patients.confirmDelete'))) return;
    
    try {
      const response = await fetch(`/api/patients/${id}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        loadPatients();
      }
    } catch (error) {
      console.error('Error deleting patient:', error);
    }
  };

  const columns = [
    {
      key: 'name',
      label: t('patients.name'),
      render: (_value: any, patient: Patient) => {
        if (!patient) return null;
        return (
          <div>
            <p className="font-medium">
              {patient.first_name || ''} {patient.last_name || ''}
            </p>
            {patient.email && (
              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                <Mail className="h-3 w-3" />
                {patient.email}
              </p>
            )}
          </div>
        );
      }
    },
    {
      key: 'phone',
      label: t('patients.phone'),
      render: (_value: any, patient: Patient) => patient?.phone ? (
        <div className="flex items-center gap-1">
          <Phone className="h-3 w-3" />
          {patient.phone}
        </div>
      ) : null,
    },
    {
      key: 'first_visit_date',
      label: t('patients.firstVisitDate'),
      render: (_value: any, patient: Patient) => patient?.first_visit_date ? (
        <div className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {formatDate(patient.first_visit_date)}
        </div>
      ) : null,
    },
    {
      key: 'city',
      label: t('patients.city'),
      render: (_value: any, patient: Patient) => patient?.city ? (
        <div className="flex items-center gap-1">
          <MapPin className="h-3 w-3" />
          {patient.city}
        </div>
      ) : null,
    },
    {
      key: 'notes',
      label: t('patients.notes'),
      render: (_value: any, patient: Patient) => patient?.notes ? (
        <div className="max-w-xs truncate text-sm text-muted-foreground">
          {patient.notes}
        </div>
      ) : null,
    },
    {
      key: 'actions',
      label: t('common.actions'),
      render: (_value: any, patient: Patient) => {
        if (!patient) return null;
        return (
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleEdit(patient)}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => patient.id && handleDelete(patient.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      }
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title={t('patients.title')}
        subtitle={t('patients.subtitle')}
      />
      
      <div className="flex justify-between items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder={t('patients.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => {
              setEditingPatient(null);
              reset();
            }}>
              <Plus className="h-4 w-4 mr-2" />
              {t('patients.addPatient')}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingPatient ? t('patients.editPatient') : t('patients.newPatient')}
              </DialogTitle>
              <DialogDescription>
                {t('patients.formDescription')}
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">{t('patients.firstName')} *</Label>
                  <Input
                    id="first_name"
                    {...register('first_name')}
                  />
                  {errors.first_name && (
                    <p className="text-sm text-red-500">{errors.first_name.message}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="last_name">{t('patients.lastName')} *</Label>
                  <Input
                    id="last_name"
                    {...register('last_name')}
                  />
                  {errors.last_name && (
                    <p className="text-sm text-red-500">{errors.last_name.message}</p>
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">{t('patients.email')}</Label>
                  <Input
                    id="email"
                    type="email"
                    {...register('email')}
                  />
                  {errors.email && (
                    <p className="text-sm text-red-500">{errors.email.message}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="phone">{t('patients.phone')}</Label>
                  <Input
                    id="phone"
                    {...register('phone')}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="birth_date">{t('patients.birthDate')}</Label>
                  <Input
                    id="birth_date"
                    type="date"
                    {...register('birth_date')}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="first_visit_date">{t('patients.firstVisitDate')}</Label>
                  <Input
                    id="first_visit_date"
                    type="date"
                    {...register('first_visit_date')}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="gender">{t('patients.gender')}</Label>
                  <Select 
                    onValueChange={(value) => setValue('gender', value === 'none' ? '' : value as any)}
                    defaultValue={editingPatient?.gender || 'none'}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('patients.selectGender')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('common.select')}</SelectItem>
                      <SelectItem value="male">{t('patients.male')}</SelectItem>
                      <SelectItem value="female">{t('patients.female')}</SelectItem>
                      <SelectItem value="other">{t('patients.other')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="source_id">{t('patients.source')}</Label>
                  <Select 
                    onValueChange={(value) => setValue('source_id', value === 'none' ? '' : value)}
                    defaultValue={editingPatient?.source_id || 'none'}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('patients.selectSource')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('common.select')}</SelectItem>
                      {patientSources.map((source) => (
                        <SelectItem key={source.id} value={source.id}>
                          {source.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="referred_by_patient_id">{t('patients.referredBy')}</Label>
                  <Select 
                    onValueChange={(value) => setValue('referred_by_patient_id', value === 'none' ? '' : value)}
                    defaultValue={editingPatient?.referred_by_patient_id || 'none'}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('patients.selectReferrer')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">
                        {t('patients.noReferrer')}
                      </SelectItem>
                      {allPatients
                        .filter(p => p.id !== editingPatient?.id)
                        .map((patient) => (
                          <SelectItem key={patient.id} value={patient.id}>
                            {patient.first_name} {patient.last_name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="campaign_name">{t('patients.campaignName')}</Label>
                  <Input
                    id="campaign_name"
                    placeholder={t('patients.campaignNamePlaceholder')}
                    {...register('campaign_name')}
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_recurring"
                  {...register('is_recurring')}
                  defaultChecked={editingPatient?.is_recurring || false}
                  onCheckedChange={(checked) => setValue('is_recurring', checked as boolean)}
                />
                <Label 
                  htmlFor="is_recurring" 
                  className="text-sm font-normal cursor-pointer"
                >
                  {t('patients.isRecurring')}
                </Label>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="address">{t('patients.address')}</Label>
                <Input
                  id="address"
                  {...register('address')}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">{t('patients.city')}</Label>
                  <Input
                    id="city"
                    {...register('city')}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="postal_code">{t('patients.postalCode')}</Label>
                  <Input
                    id="postal_code"
                    {...register('postal_code')}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="notes">{t('patients.notes')}</Label>
                <Textarea
                  id="notes"
                  rows={3}
                  {...register('notes')}
                />
              </div>
              
              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsCreateOpen(false);
                    setEditingPatient(null);
                    reset();
                  }}
                >
                  {t('common.cancel')}
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? t('common.saving') : t('common.save')}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center">
              <p>{t('common.loading')}</p>
            </div>
          ) : patients.length === 0 ? (
            <EmptyState
              icon={<Users className="h-8 w-8" />}
              title={t('patients.noPatients')}
              description={t('patients.noPatientDescription')}
              action={
                <Button onClick={() => {
                  setEditingPatient(null);
                  reset();
                  setIsCreateOpen(true);
                }}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('patients.addFirstPatient')}
                </Button>
              }
            />
          ) : (
            <DataTable
              columns={columns}
              data={patients}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}