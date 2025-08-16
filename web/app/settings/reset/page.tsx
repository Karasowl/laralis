'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertTriangle, Trash2, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { useToast } from '@/hooks/use-toast';

interface ResetOption {
  id: string;
  label: string;
  description: string;
  dangerous?: boolean;
}

export default function ResetPage() {
  const t = useTranslations();
  const { toast } = useToast();
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [isResetting, setIsResetting] = useState(false);
  const [resetStatus, setResetStatus] = useState<{ [key: string]: 'pending' | 'success' | 'error' }>({});
  const [confirmText, setConfirmText] = useState('');
  const [dataStatus, setDataStatus] = useState<any>(null);

  const resetOptions: ResetOption[] = [
    {
      id: 'services',
      label: 'Servicios',
      description: 'Eliminar todos los servicios y sus recetas de insumos'
    },
    {
      id: 'supplies',
      label: 'Insumos',
      description: 'Eliminar todos los insumos (verificar que no estén en uso primero)'
    },
    {
      id: 'fixed_costs',
      label: 'Costos Fijos',
      description: 'Eliminar todos los costos fijos mensuales'
    },
    {
      id: 'assets',
      label: 'Activos',
      description: 'Eliminar todos los activos y depreciaciones'
    },
    {
      id: 'time_settings',
      label: 'Configuración de Tiempo',
      description: 'Restablecer configuración de tiempo a valores por defecto'
    },
    {
      id: 'custom_categories',
      label: 'Categorías Personalizadas',
      description: 'Eliminar solo las categorías personalizadas (mantiene las del sistema)'
    },
    {
      id: 'all_data',
      label: '🚨 TODOS LOS DATOS',
      description: 'Eliminar TODOS los datos del negocio (excepto la clínica)',
      dangerous: true
    }
  ];

  const handleToggleOption = (optionId: string) => {
    setSelectedOptions(prev => {
      if (prev.includes(optionId)) {
        return prev.filter(id => id !== optionId);
      }
      // Si selecciona "all_data", deseleccionar todo lo demás
      if (optionId === 'all_data') {
        return [optionId];
      }
      // Si selecciona algo más, deseleccionar "all_data"
      return [...prev.filter(id => id !== 'all_data'), optionId];
    });
  };

  const handleReset = async () => {
    if (selectedOptions.length === 0) {
      toast({
        title: "Atención",
        description: "Selecciona al menos una opción para limpiar",
        variant: "destructive",
      });
      return;
    }

    // Validación extra para opciones peligrosas
    if (selectedOptions.includes('all_data')) {
      if (confirmText !== 'BORRAR TODO') {
        toast({
          title: "Confirmación requerida",
          description: 'Escribe "BORRAR TODO" en el campo de confirmación',
          variant: "destructive",
        });
        return;
      }
    }

    if (!confirm('¿Estás seguro de que quieres eliminar estos datos? Esta acción no se puede deshacer.')) {
      return;
    }

    setIsResetting(true);
    const newStatus: { [key: string]: 'pending' | 'success' | 'error' } = {};
    let successCount = 0;
    let errorCount = 0;
    const results: string[] = [];

    for (const option of selectedOptions) {
      newStatus[option] = 'pending';
      setResetStatus({ ...newStatus });

      try {
        const res = await fetch('/api/reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resetType: option })
        });

        if (res.ok) {
          const data = await res.json();
          newStatus[option] = 'success';
          successCount++;
          results.push(`✓ ${getOptionLabel(option)}: ${data.message}`);
        } else {
          newStatus[option] = 'error';
          errorCount++;
          const error = await res.json();
          results.push(`✗ ${getOptionLabel(option)}: ${error.error}`);
          console.error(`Error resetting ${option}:`, error);
        }
      } catch (error) {
        newStatus[option] = 'error';
        errorCount++;
        results.push(`✗ ${getOptionLabel(option)}: Error de conexión`);
        console.error(`Error resetting ${option}:`, error);
      }

      setResetStatus({ ...newStatus });
    }

    setIsResetting(false);
    
    // Mostrar notificación con resumen
    if (errorCount === 0) {
      toast({
        title: "✅ Limpieza completada exitosamente",
        description: (
          <div className="space-y-1">
            {results.map((r, i) => (
              <div key={i} className="text-sm">{r}</div>
            ))}
          </div>
        ),
        duration: 5000,
      });
    } else if (successCount > 0) {
      toast({
        title: "⚠️ Limpieza parcialmente completada",
        description: (
          <div className="space-y-1">
            <div>{`${successCount} exitosos, ${errorCount} con errores`}</div>
            {results.map((r, i) => (
              <div key={i} className="text-sm">{r}</div>
            ))}
          </div>
        ),
        variant: "destructive",
        duration: 5000,
      });
    } else {
      toast({
        title: "❌ Error en la limpieza",
        description: "No se pudo completar ninguna operación de limpieza",
        variant: "destructive",
        duration: 5000,
      });
    }
    
    // Si se borró todo, redirigir al onboarding
    if (selectedOptions.includes('all_data') && successCount > 0) {
      setTimeout(() => {
        window.location.href = '/onboarding';
      }, 2000);
    } else {
      // Limpiar selección después de completar
      setTimeout(() => {
        setSelectedOptions([]);
        setResetStatus({});
        setConfirmText('');
        fetchDataStatus(); // Actualizar el estado
      }, 3000);
    }
  };

  // Función helper para obtener el label de la opción
  const getOptionLabel = (optionId: string) => {
    const option = resetOptions.find(o => o.id === optionId);
    return option?.label || optionId;
  };

  // Verificar estado de los datos
  const fetchDataStatus = async () => {
    try {
      const res = await fetch('/api/reset/status');
      if (res.ok) {
        const data = await res.json();
        setDataStatus(data);
      }
    } catch (error) {
      console.error('Error fetching data status:', error);
    }
  };

  useEffect(() => {
    fetchDataStatus();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Configuración y Reset" 
        subtitle="Limpiar datos de prueba para configurar desde cero"
      />

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <strong>Advertencia:</strong> Estas acciones eliminarán permanentemente los datos seleccionados. 
          Úsalo solo para limpiar datos de prueba antes de configurar el negocio real.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Limpiar Datos de Prueba</CardTitle>
          <CardDescription>
            Selecciona qué datos quieres eliminar para empezar de cero
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {resetOptions.map(option => (
            <div
              key={option.id}
              className={`flex items-start space-x-3 p-3 rounded-lg border ${
                option.dangerous ? 'border-red-500 bg-red-50' : 'border-border'
              } ${selectedOptions.includes(option.id) ? 'bg-accent' : ''}`}
            >
              <Checkbox
                id={option.id}
                checked={selectedOptions.includes(option.id)}
                onCheckedChange={() => handleToggleOption(option.id)}
                disabled={isResetting}
              />
              <div className="flex-1">
                <label
                  htmlFor={option.id}
                  className={`text-sm font-medium cursor-pointer ${
                    option.dangerous ? 'text-red-600' : ''
                  }`}
                >
                  {option.label}
                </label>
                <p className="text-sm text-muted-foreground">
                  {option.description}
                </p>
              </div>
              {resetStatus[option.id] && (
                <div className="flex items-center">
                  {resetStatus[option.id] === 'pending' && (
                    <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />
                  )}
                  {resetStatus[option.id] === 'success' && (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  )}
                  {resetStatus[option.id] === 'error' && (
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                  )}
                </div>
              )}
            </div>
          ))}

          {selectedOptions.includes('all_data') && (
            <div className="p-3 bg-red-100 border border-red-300 rounded-lg">
              <p className="text-sm font-medium text-red-800 mb-2">
                Para confirmar el borrado total, escribe "BORRAR TODO":
              </p>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="w-full px-3 py-2 border border-red-300 rounded-md"
                placeholder="BORRAR TODO"
                disabled={isResetting}
              />
            </div>
          )}

          <div className="flex justify-between items-center pt-4">
            <p className="text-sm text-muted-foreground">
              {selectedOptions.length} opción(es) seleccionada(s)
            </p>
            <Button
              onClick={handleReset}
              disabled={isResetting || selectedOptions.length === 0}
              variant={selectedOptions.includes('all_data') ? 'destructive' : 'default'}
            >
              {isResetting ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Limpiando...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Limpiar Datos Seleccionados
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>Estado de Configuración</CardTitle>
              <CardDescription>
                Checklist de lo que está configurado y lo que falta
              </CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={fetchDataStatus}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <ChecklistItem 
              label="Configuración de Tiempo" 
              completed={dataStatus?.timeConfigured || false} 
              count={null}
            />
            <ChecklistItem 
              label="Activos y Depreciación" 
              completed={(dataStatus?.assets || 0) > 0} 
              count={dataStatus?.assets}
            />
            <ChecklistItem 
              label="Costos Fijos Mensuales" 
              completed={(dataStatus?.fixedCosts || 0) > 0} 
              count={dataStatus?.fixedCosts}
            />
            <ChecklistItem 
              label="Insumos Dentales" 
              completed={(dataStatus?.supplies || 0) > 0} 
              count={dataStatus?.supplies}
            />
            <ChecklistItem 
              label="Servicios con Costos Variables" 
              completed={(dataStatus?.services || 0) > 0} 
              count={dataStatus?.services}
            />
            <ChecklistItem 
              label="Categorías Personalizadas" 
              completed={(dataStatus?.customCategories || 0) > 0} 
              count={dataStatus?.customCategories}
            />
            <ChecklistItem label="Tarifario con Márgenes" completed={false} count={null} />
            <ChecklistItem label="Punto de Equilibrio" completed={false} count={null} />
            <ChecklistItem label="Base de Pacientes" completed={false} count={null} />
            <ChecklistItem label="Registro de Tratamientos" completed={false} count={null} />
          </div>
          
          {dataStatus?.hasData && (
            <Alert className="mt-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Tienes datos en el sistema. Usa las opciones de arriba para limpiar los datos de prueba antes de configurar el negocio real.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ChecklistItem({ label, completed, count }: { label: string; completed: boolean; count?: number | null }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-2">
        {completed ? (
          <CheckCircle className="h-4 w-4 text-green-500" />
        ) : (
          <div className="h-4 w-4 rounded-full border-2 border-gray-300" />
        )}
        <span className={`text-sm ${completed ? 'text-muted-foreground' : ''}`}>
          {label}
        </span>
      </div>
      {count !== null && count !== undefined && (
        <span className="text-xs text-muted-foreground">
          ({count} registros)
        </span>
      )}
    </div>
  );
}