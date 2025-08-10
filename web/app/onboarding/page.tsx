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
  Stars,
  Stethoscope,
  Calculator,
  TrendingUp
} from 'lucide-react';
import { useTranslations } from 'next-intl';

interface OnboardingStep {
  id: number;
  title: string;
  description: string;
  icon: React.ReactNode;
}

export default function OnboardingPage() {
  const router = useRouter();
  const { toast } = useToast();
  const t = useTranslations('onboarding');
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
      title: t('welcomeTitle'),
      description: t('welcomeSubtitle'),
      icon: <Stars className="h-8 w-8" />
    },
    {
      id: 1,
      title: t('workspaceStep.title'),
      description: t('workspaceStep.subtitle'),
      icon: <Building2 className="h-8 w-8" />
    },
    {
      id: 2,
      title: t('clinicStep.title'),
      description: t('clinicStep.subtitle'),
      icon: <Stethoscope className="h-8 w-8" />
    },
    {
      id: 3,
      title: t('doneStep.title'),
      description: t('doneStep.subtitle'),
      icon: <Check className="h-8 w-8" />
    }
  ];

  // Restaurar avances una vez montado (evita desajustes de hidratación)
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = window.sessionStorage.getItem('onboarding.step');
        if (saved !== null) {
          const idx = Number.parseInt(saved, 10);
          if (Number.isFinite(idx)) {
            setCurrentStep(Math.max(0, Math.min(3, idx)));
          }
        }
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persistir avances

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem('onboarding.step', String(currentStep));
      }
    } catch {}
  }, [currentStep]);

  const handleNext = async () => {
    if (currentStep === 1) {
      // Validar workspace
      if (!workspaceData.name) {
        toast({
          title: t('errors.requiredTitle'),
          description: t('errors.workspaceNameRequired'),
          variant: 'destructive',
        });
        return;
      }
    } else if (currentStep === 2) {
      // Validar clínica
      if (!clinicData.name) {
        toast({
          title: t('errors.requiredTitle'),
          description: t('errors.clinicNameRequired'),
          variant: 'destructive',
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
          clinicAddress: clinicData.address
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || t('errors.createWorkspace'));
      }

      const result = await response.json();

      toast({
        title: t('success.title'),
        description: t('success.description'),
      });

      // Forzar recarga completa para actualizar el contexto
      window.location.href = '/';

    } catch (error: any) {
      console.error('Error en onboarding:', error);
      toast({
        title: t('errors.genericTitle'),
        description: error.message || t('errors.genericDescription'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const progress = Math.round(((currentStep + 1) / steps.length) * 100);

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
                <p className="text-lg">{t('welcomeBody')}</p>
                <div className="grid grid-cols-2 gap-4 mt-6">
                  <FeatureCard
                    icon={<Calculator className="h-6 w-6" />}
                    title={t('features.calc.title')}
                    description={t('features.calc.desc')}
                  />
                  <FeatureCard
                    icon={<Users className="h-6 w-6" />}
                    title={t('features.multi.title')}
                    description={t('features.multi.desc')}
                  />
                  <FeatureCard
                    icon={<TrendingUp className="h-6 w-6" />}
                    title={t('features.reports.title')}
                    description={t('features.reports.desc')}
                  />
                  <FeatureCard
                    icon={<Settings className="h-6 w-6" />}
                    title={t('features.custom.title')}
                    description={t('features.custom.desc')}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 1: Create Workspace */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="workspace-name">{t('workspaceStep.nameLabel')}</Label>
                <Input
                  id="workspace-name"
                  placeholder={t('workspaceStep.namePlaceholder')}
                  value={workspaceData.name}
                  onChange={(e) => setWorkspaceData({
                    ...workspaceData,
                    name: e.target.value
                  })}
                />
                <p className="text-sm text-muted-foreground">{t('workspaceStep.nameHelp')}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="workspace-desc">{t('workspaceStep.descLabel')}</Label>
                <Input
                  id="workspace-desc"
                  placeholder={t('workspaceStep.descPlaceholder')}
                  value={workspaceData.description}
                  onChange={(e) => setWorkspaceData({
                    ...workspaceData,
                    description: e.target.value
                  })}
                />
              </div>

              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-blue-800">
                  💡 <strong>{t('tips.title')}</strong> {t('tips.workspaceMulti')}
                </p>
              </div>
            </div>
          )}

          {/* Step 2: Create First Clinic */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="clinic-name">{t('clinicStep.nameLabel')}</Label>
                <Input
                  id="clinic-name"
                  placeholder={t('clinicStep.namePlaceholder')}
                  value={clinicData.name}
                  onChange={(e) => setClinicData({
                    ...clinicData,
                    name: e.target.value
                  })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="clinic-address">{t('clinicStep.addressLabel')}</Label>
                <Input
                  id="clinic-address"
                  placeholder={t('clinicStep.addressPlaceholder')}
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
                    {t('clinicStep.phoneLabel')}
                  </Label>
                  <Input
                    id="clinic-phone"
                    placeholder={t('clinicStep.phonePlaceholder')}
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
                    placeholder={t('clinicStep.emailPlaceholder')}
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
                  💡 <strong>{t('notes.title')}</strong> {t('notes.addMoreClinics')}
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
                  <h3 className="text-lg font-semibold">{t('doneStep.doneHeadline')}</h3>
                  <p className="text-muted-foreground mt-2">{t('doneStep.created')}</p>
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
                  <p className="font-medium">{t('doneStep.nextSteps')}</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>✓ {t('doneStep.todo.time')}</li>
                    <li>✓ {t('doneStep.todo.fixed')}</li>
                    <li>✓ {t('doneStep.todo.supplies')}</li>
                    <li>✓ {t('doneStep.todo.services')}</li>
                    <li>✓ {t('doneStep.todo.tariffs')}</li>
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
              {t('actions.prev')}
            </Button>

            {currentStep < steps.length - 1 ? (
              <Button onClick={handleNext}>
                {t('actions.next')}
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button 
                onClick={handleComplete}
                disabled={isLoading}
                className="bg-green-600 hover:bg-green-700"
              >
                {isLoading ? (
                  <>{t('actions.creating')}</>
                ) : (
                  <>
                    {t('actions.start')}
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