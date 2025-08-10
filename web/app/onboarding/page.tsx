'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { 
  Building2, 
  Users, 
  Settings, 
  ChevronRight, 
  ChevronLeft,
  Check,
  Sparkles,
  Stethoscope,
  Calculator,
  TrendingUp
} from 'lucide-react';

interface OnboardingStep {
  id: number;
  title: string;
  description: string;
  icon: React.ReactNode;
}

export default function OnboardingPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  
  // Form data
  const [workspaceData, setWorkspaceData] = useState({
    name: '',
    description: ''
  });
  
  const [clinicData, setClinicData] = useState({
    name: '',
    address: '',
    phone: '',
    email: ''
  });

  const steps: OnboardingStep[] = [
    {
      id: 0,
      title: '¡Bienvenido a Laralis! 🎉',
      description: 'Sistema de gestión dental completo',
      icon: <Sparkles className="h-8 w-8" />
    },
    {
      id: 1,
      title: 'Crea tu Espacio de Trabajo',
      description: 'Como una marca en Metricool',
      icon: <Building2 className="h-8 w-8" />
    },
    {
      id: 2,
      title: 'Agrega tu Primera Clínica',
      description: 'Puedes agregar más después',
      icon: <Stethoscope className="h-8 w-8" />
    },
    {
      id: 3,
      title: '¡Todo Listo! 🚀',
      description: 'Comienza a configurar tu negocio',
      icon: <Check className="h-8 w-8" />
    }
  ];

  const handleNext = async () => {
    if (currentStep === 1) {
      // Validar workspace
      if (!workspaceData.name) {
        toast({
          title: "Campo requerido",
          description: "Por favor ingresa un nombre para tu espacio de trabajo",
          variant: "destructive"
        });
        return;
      }
    } else if (currentStep === 2) {
      // Validar clínica
      if (!clinicData.name) {
        toast({
          title: "Campo requerido",
          description: "Por favor ingresa un nombre para tu clínica",
          variant: "destructive"
        });
        return;
      }
    }

    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    setIsLoading(true);
    
    try {
      // Generar slug automático desde el nombre del workspace
      const slug = workspaceData.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') + '-' + Date.now().toString(36);

      // Crear workspace y clínica en una sola llamada
      const response = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceName: workspaceData.name,
          workspaceSlug: slug,
          clinicName: clinicData.name,
          clinicAddress: clinicData.address,
          ownerEmail: ownerData.email
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error creando workspace');
      }

      const result = await response.json();

      toast({
        title: "✅ ¡Configuración completada!",
        description: "Tu espacio de trabajo y clínica han sido creados exitosamente",
      });

      // Redirigir al dashboard
      setTimeout(() => {
        router.push('/');
      }, 1500);

    } catch (error: any) {
      console.error('Error en onboarding:', error);
      toast({
        title: "Error",
        description: error.message || "Hubo un problema al crear tu configuración",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <Progress value={progress} className="mb-4" />
          <div className="flex items-center justify-center mb-4 text-blue-600">
            {steps[currentStep].icon}
          </div>
          <CardTitle className="text-2xl text-center">
            {steps[currentStep].title}
          </CardTitle>
          <CardDescription className="text-center">
            {steps[currentStep].description}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Step 0: Welcome */}
          {currentStep === 0 && (
            <div className="space-y-6">
              <div className="text-center space-y-4">
                <p className="text-lg">
                  Gestiona tu consultorio dental de manera profesional
                </p>
                <div className="grid grid-cols-2 gap-4 mt-6">
                  <FeatureCard
                    icon={<Calculator className="h-6 w-6" />}
                    title="Cálculo Automático"
                    description="Costos, márgenes y tarifas"
                  />
                  <FeatureCard
                    icon={<Users className="h-6 w-6" />}
                    title="Multi-Clínica"
                    description="Gestiona varias sucursales"
                  />
                  <FeatureCard
                    icon={<TrendingUp className="h-6 w-6" />}
                    title="Reportes Detallados"
                    description="Métricas y análisis"
                  />
                  <FeatureCard
                    icon={<Settings className="h-6 w-6" />}
                    title="Personalizable"
                    description="Adapta a tu negocio"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 1: Create Workspace */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="workspace-name">
                  Nombre del Espacio de Trabajo *
                </Label>
                <Input
                  id="workspace-name"
                  placeholder="Ej: Clínicas Dentales García"
                  value={workspaceData.name}
                  onChange={(e) => setWorkspaceData({
                    ...workspaceData,
                    name: e.target.value
                  })}
                />
                <p className="text-sm text-muted-foreground">
                  Este es el nombre principal de tu organización
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="workspace-desc">
                  Descripción (opcional)
                </Label>
                <Input
                  id="workspace-desc"
                  placeholder="Ej: Red de clínicas dentales especializadas"
                  value={workspaceData.description}
                  onChange={(e) => setWorkspaceData({
                    ...workspaceData,
                    description: e.target.value
                  })}
                />
              </div>

              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-blue-800">
                  💡 <strong>Tip:</strong> Un espacio de trabajo puede contener múltiples clínicas.
                  Es como una "marca" que agrupa todas tus sucursales.
                </p>
              </div>
            </div>
          )}

          {/* Step 2: Create First Clinic */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="clinic-name">
                  Nombre de la Clínica *
                </Label>
                <Input
                  id="clinic-name"
                  placeholder="Ej: Sucursal Centro"
                  value={clinicData.name}
                  onChange={(e) => setClinicData({
                    ...clinicData,
                    name: e.target.value
                  })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="clinic-address">
                  Dirección
                </Label>
                <Input
                  id="clinic-address"
                  placeholder="Ej: Av. Principal 123"
                  value={clinicData.address}
                  onChange={(e) => setClinicData({
                    ...clinicData,
                    address: e.target.value
                  })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="clinic-phone">
                    Teléfono
                  </Label>
                  <Input
                    id="clinic-phone"
                    placeholder="Ej: +52 555 1234567"
                    value={clinicData.phone}
                    onChange={(e) => setClinicData({
                      ...clinicData,
                      phone: e.target.value
                    })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="clinic-email">
                    Email
                  </Label>
                  <Input
                    id="clinic-email"
                    type="email"
                    placeholder="contacto@clinica.com"
                    value={clinicData.email}
                    onChange={(e) => setClinicData({
                      ...clinicData,
                      email: e.target.value
                    })}
                  />
                </div>
              </div>

              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-green-800">
                  💡 <strong>Nota:</strong> Podrás agregar más clínicas después desde el panel de configuración.
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Complete */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center">
                    <Check className="h-8 w-8 text-green-600" />
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold">
                    ¡Configuración Inicial Completada!
                  </h3>
                  <p className="text-muted-foreground mt-2">
                    Has creado:
                  </p>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 text-left space-y-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-blue-600" />
                    <span className="font-medium">{workspaceData.name}</span>
                  </div>
                  <div className="flex items-center gap-2 ml-6">
                    <Stethoscope className="h-4 w-4 text-green-600" />
                    <span>{clinicData.name}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="font-medium">Próximos pasos:</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>✓ Configurar tiempo de trabajo</li>
                    <li>✓ Agregar costos fijos</li>
                    <li>✓ Cargar insumos</li>
                    <li>✓ Crear servicios</li>
                    <li>✓ Definir tarifario</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between pt-4">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === 0}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Anterior
            </Button>

            {currentStep < steps.length - 1 ? (
              <Button onClick={handleNext}>
                Siguiente
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button 
                onClick={handleComplete}
                disabled={isLoading}
                className="bg-green-600 hover:bg-green-700"
              >
                {isLoading ? (
                  <>Creando...</>
                ) : (
                  <>
                    Comenzar
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function FeatureCard({ 
  icon, 
  title, 
  description 
}: { 
  icon: React.ReactNode; 
  title: string; 
  description: string;
}) {
  return (
    <div className="bg-white p-4 rounded-lg border text-left">
      <div className="text-blue-600 mb-2">{icon}</div>
      <h4 className="font-medium text-sm">{title}</h4>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}