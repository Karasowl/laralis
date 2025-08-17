'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useWorkspace } from '@/contexts/workspace-context';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DataTable } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Edit, Trash2, Calendar, User, DollarSign, FileText } from 'lucide-react';
import { formatCurrency } from '@/lib/money';
import { formatDate } from '@/lib/format';

interface Patient {
  id: string;
  first_name: string;
  last_name: string;
}

interface Service {
  id: string;
  name: string;
  variable_cost_cents: number;
}

interface Treatment {
  id: string;
  patient_id: string;
  patient?: Patient;
  service_id: string;
  service?: Service;
  treatment_date: string;
  minutes: number;
  fixed_per_minute_cents: number;
  variable_cost_cents: number;
  margin_pct: number;
  price_cents: number;
  tariff_version?: number;
  status: 'pending' | 'completed' | 'cancelled';
  notes?: string;
  created_at: string;
}

export default function TreatmentsPage() {
  const t = useTranslations();
  const { currentClinic } = useWorkspace(); // ✅ Obtener clínica actual
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [editingTreatment, setEditingTreatment] = useState<Treatment | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    patient_id: '',
    service_id: '',
    treatment_date: new Date().toISOString().split('T')[0],
    minutes: 30,
    margin_pct: 60,
    notes: '',
    status: 'pending' as const
  });

  // ✅ Recargar cuando cambie la clínica
  useEffect(() => {
    if (currentClinic?.id) {
      loadData();
    }
  }, [currentClinic?.id]);

  const loadData = async () => {
    if (!currentClinic?.id) return; // ✅ No cargar sin clínica
    
    try {
      // Load treatments for current clinic
      const treatmentsRes = await fetch(`/api/treatments?clinicId=${currentClinic.id}`);
      if (treatmentsRes.ok) {
        const data = await treatmentsRes.json();
        setTreatments(data.data || []);
      }

      // Load patients for current clinic
      const patientsRes = await fetch(`/api/patients?clinicId=${currentClinic.id}`);
      if (patientsRes.ok) {
        const data = await patientsRes.json();
        setPatients(data.data || []);
      }

      // Load services for current clinic
      const servicesRes = await fetch(`/api/services?clinicId=${currentClinic.id}`);
      if (servicesRes.ok) {
        const data = await servicesRes.json();
        setServices(data || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const selectedService = services.find(s => s.id === formData.service_id);
      if (!selectedService) return;

      // Snapshot-friendly cost resolution
      let fixedPerMinuteCents = 0;
      let variableCost = 0;

      if (editingTreatment) {
        // Use stored snapshot values to avoid recalculation from current config
        fixedPerMinuteCents = editingTreatment.fixed_per_minute_cents || 0;
        // If service changed, snapshot variable cost from current selected service; otherwise keep stored
        variableCost = (formData.service_id !== editingTreatment.service_id)
          ? (selectedService.variable_cost_cents || 0)
          : (editingTreatment.variable_cost_cents || 0);
      } else {
        // New treatment: snapshot from current settings/service
        const settingsRes = await fetch('/api/settings/time');
        if (settingsRes.ok) {
          const settings = await settingsRes.json();
          fixedPerMinuteCents = settings.data?.fixed_per_minute_cents || 0;
        }
        variableCost = selectedService.variable_cost_cents || 0;
      }

      // Calculate costs and price using resolved snapshot values
      const fixedCost = fixedPerMinuteCents * formData.minutes;
      const totalCost = fixedCost + variableCost;
      const price = Math.round(totalCost * (1 + formData.margin_pct / 100));

      const treatmentData = {
        ...formData,
        fixed_per_minute_cents: fixedPerMinuteCents,
        variable_cost_cents: variableCost,
        price_cents: price,
        tariff_version: editingTreatment?.tariff_version || 1, // Por defecto versión 1
        snapshot_costs: {
          fixed_cost_cents: fixedCost,
          variable_cost_cents: variableCost,
          total_cost_cents: totalCost,
          margin_pct: formData.margin_pct,
          price_cents: price,
          tariff_version: editingTreatment?.tariff_version || 1
        }
      };

      const url = editingTreatment
        ? `/api/treatments/${editingTreatment.id}`
        : '/api/treatments';
      const method = editingTreatment ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(treatmentData)
      });

      if (res.ok) {
        loadData();
        setIsOpen(false);
        resetForm();
      } else {
        const error = await res.json();
        alert(error.message || 'Error al guardar tratamiento');
      }
    } catch (error) {
      console.error('Error saving treatment:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este tratamiento?')) return;

    try {
      const res = await fetch(`/api/treatments/${id}`, { method: 'DELETE' });
      if (res.ok) {
        loadData();
      }
    } catch (error) {
      console.error('Error deleting treatment:', error);
    }
  };

  const handleEdit = (treatment: Treatment) => {
    setEditingTreatment(treatment);
    setFormData({
      patient_id: treatment.patient_id,
      service_id: treatment.service_id,
      treatment_date: treatment.treatment_date,
      minutes: treatment.minutes,
      margin_pct: treatment.margin_pct,
      notes: treatment.notes || '',
      status: treatment.status
    });
    setIsOpen(true);
  };

  const resetForm = () => {
    setFormData({
      patient_id: '',
      service_id: '',
      treatment_date: new Date().toISOString().split('T')[0],
      minutes: 30,
      margin_pct: 60,
      notes: '',
      status: 'pending'
    });
    setEditingTreatment(null);
  };

  const columns = [
    {
      key: 'date',
      label: 'Fecha',
      render: (_value: any, treatment: Treatment) => (
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          {formatDate(treatment.treatment_date)}
        </div>
      )
    },
    {
      key: 'patient',
      label: 'Paciente',
      render: (_value: any, treatment: Treatment) => (
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" />
          {treatment.patient ? 
            `${treatment.patient.first_name} ${treatment.patient.last_name}` : 
            'N/A'}
        </div>
      )
    },
    {
      key: 'service',
      label: 'Servicio',
      render: (_value: any, treatment: Treatment) => treatment.service?.name || 'N/A'
    },
    {
      key: 'duration',
      label: 'Duración',
      render: (_value: any, treatment: Treatment) => `${treatment.minutes} min`
    },
    {
      key: 'price',
      label: 'Precio',
      render: (_value: any, treatment: Treatment) => (
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-muted-foreground" />
          {formatCurrency(treatment.price_cents)}
        </div>
      )
    },
    {
      key: 'status',
      label: 'Estado',
      render: (_value: any, treatment: Treatment) => {
        const statusColors = {
          pending: 'bg-yellow-100 text-yellow-800',
          completed: 'bg-green-100 text-green-800',
          cancelled: 'bg-red-100 text-red-800'
        };
        const statusLabels = {
          pending: 'Pendiente',
          completed: 'Completado',
          cancelled: 'Cancelado'
        };
        return (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[treatment.status]}`}>
            {statusLabels[treatment.status]}
          </span>
        );
      }
    },
    {
      key: 'actions',
      label: 'Acciones',
      render: (_value: any, treatment: Treatment) => (
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => handleEdit(treatment)}>
            <Edit className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => handleDelete(treatment.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('treatments.title')}
        subtitle={t('treatments.subtitle')}
      />

      <div className="flex justify-end">
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { resetForm(); }}>
              <Plus className="h-4 w-4 mr-2" />
              Agregar Tratamiento
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingTreatment ? 'Editar Tratamiento' : 'Nuevo Tratamiento'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="patient">Paciente</Label>
                  <Select
                    value={formData.patient_id}
                    onValueChange={(value) => setFormData({ ...formData, patient_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un paciente" />
                    </SelectTrigger>
                    <SelectContent>
                      {patients.map(patient => (
                        <SelectItem key={patient.id} value={patient.id}>
                          {patient.first_name} {patient.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="service">Servicio</Label>
                  <Select
                    value={formData.service_id}
                    onValueChange={(value) => {
                      const service = services.find(s => s.id === value);
                      if (service) {
                        setFormData({ 
                          ...formData, 
                          service_id: value,
                          minutes: service.est_minutes || 30
                        });
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un servicio" />
                    </SelectTrigger>
                    <SelectContent>
                      {services.map(service => (
                        <SelectItem key={service.id} value={service.id}>
                          {service.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="date">Fecha</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.treatment_date}
                    onChange={(e) => setFormData({ ...formData, treatment_date: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="minutes">Duración (minutos)</Label>
                  <Input
                    id="minutes"
                    type="number"
                    value={formData.minutes}
                    onChange={(e) => setFormData({ ...formData, minutes: parseInt(e.target.value) || 0 })}
                  />
                </div>

                <div>
                  <Label htmlFor="margin">Margen (%)</Label>
                  <Input
                    id="margin"
                    type="number"
                    value={formData.margin_pct}
                    onChange={(e) => setFormData({ ...formData, margin_pct: parseInt(e.target.value) || 0 })}
                  />
                </div>

                <div>
                  <Label htmlFor="status">Estado</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value: 'pending' | 'completed' | 'cancelled') => 
                      setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pendiente</SelectItem>
                      <SelectItem value="completed">Completado</SelectItem>
                      <SelectItem value="cancelled">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Notas</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Notas adicionales del tratamiento..."
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingTreatment ? 'Actualizar' : 'Guardar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historial de Tratamientos</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Cargando...</div>
          ) : treatments.length === 0 ? (
            <EmptyState
              icon={<FileText className="h-8 w-8" />}
              title="No hay tratamientos registrados"
              description="Comienza agregando tu primer tratamiento"
            />
          ) : (
            <DataTable columns={columns} data={treatments} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}