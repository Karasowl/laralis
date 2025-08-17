'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTranslations } from 'next-intl';
import { useWorkspace } from '@/contexts/workspace-context';

export default function MarketingSettingsClient() {
  const t = useTranslations();
  const { currentClinic } = useWorkspace(); // ✅ Obtener clínica actual
  const [platforms, setPlatforms] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [selectedPlatformId, setSelectedPlatformId] = useState<string>('none');
  const [newPlatformName, setNewPlatformName] = useState('');
  const [newCampaignName, setNewCampaignName] = useState('');

  const loadPlatforms = async () => {
    if (!currentClinic?.id) return; // ✅ No cargar sin clínica
    
    const res = await fetch(`/api/marketing/platforms?clinicId=${currentClinic.id}`);
    if (res.ok) {
      const json = await res.json();
      setPlatforms(json.data || []);
    }
  };

  const loadCampaigns = async (platformId: string) => {
    if (!platformId || platformId === 'none') { setCampaigns([]); return; }
    const res = await fetch(`/api/marketing/campaigns?platformId=${platformId}&includeArchived=true`);
    if (res.ok) {
      const json = await res.json();
      setCampaigns(json.data || []);
    }
  };

  // ✅ Recargar cuando cambie la clínica
  useEffect(() => {
    loadPlatforms();
  }, [currentClinic?.id]);

  useEffect(() => {
    loadCampaigns(selectedPlatformId);
  }, [selectedPlatformId]);

  const createPlatform = async () => {
    if (!newPlatformName.trim()) return;
    const res = await fetch('/api/marketing/platforms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name: newPlatformName })
    });
    if (res.ok) {
      setNewPlatformName('');
      await loadPlatforms();
    }
  };

  const editPlatform = async (id: string, newName: string) => {
    const res = await fetch('/api/marketing/platforms', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, display_name: newName })
    });
    if (res.ok) await loadPlatforms();
  };

  const deletePlatform = async (id: string) => {
    if (!confirm('¿Eliminar esta plataforma? Se eliminarán también sus campañas.')) return;
    const res = await fetch('/api/marketing/platforms', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    if (res.ok) await loadPlatforms();
  };

  const createCampaign = async () => {
    if (!newCampaignName.trim() || selectedPlatformId === 'none') return;
    const res = await fetch('/api/marketing/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform_id: selectedPlatformId, name: newCampaignName })
    });
    if (res.ok) {
      setNewCampaignName('');
      await loadCampaigns(selectedPlatformId);
    }
  };

  const updateCampaign = async (id: string, patch: any) => {
    const res = await fetch('/api/marketing/campaigns', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...patch })
    });
    if (res.ok) await loadCampaigns(selectedPlatformId);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.marketing.platformsTitle', { default: 'Plataformas' })}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-2">
              <Label>{t('settings.marketing.platformName', { default: 'Nombre de plataforma' })}</Label>
              <Input value={newPlatformName} onChange={e => setNewPlatformName(e.target.value)} placeholder={t('settings.marketing.platformNamePlaceholder', { default: 'ej. Meta Ads' })} />
            </div>
            <Button onClick={createPlatform}>{t('settings.marketing.addPlatform', { default: 'Agregar' })}</Button>
          </div>
          <div className="space-y-2">
            {platforms.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <div className="font-medium">{p.display_name || p.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.is_system ? 'Sistema' : 'Personalizada'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!p.is_system && (
                    <>
                      <Button variant="outline" onClick={() => {
                        const newName = prompt('Nuevo nombre:', p.display_name || p.name);
                        if (newName && newName.trim()) editPlatform(p.id, newName.trim());
                      }}>
                        Editar
                      </Button>
                      <Button variant="outline" onClick={() => deletePlatform(p.id)}>
                        Eliminar
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.marketing.campaignsTitle', { default: 'Campañas' })}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t('settings.marketing.selectPlatform', { default: 'Selecciona plataforma' })}</Label>
            <Select onValueChange={(v) => setSelectedPlatformId(v)} defaultValue={selectedPlatformId}>
              <SelectTrigger>
                <SelectValue placeholder={t('settings.marketing.selectPlatform', { default: 'Selecciona plataforma' })} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('common.select')}</SelectItem>
                {platforms.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.display_name || p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-2">
              <Label>{t('settings.marketing.campaignName', { default: 'Nombre de campaña' })}</Label>
              <Input value={newCampaignName} onChange={e => setNewCampaignName(e.target.value)} placeholder={t('settings.marketing.campaignNamePlaceholder', { default: 'ej. Promos Febrero' })} />
            </div>
            <Button onClick={createCampaign} disabled={selectedPlatformId==='none'}>{t('settings.marketing.addCampaign', { default: 'Agregar' })}</Button>
          </div>

          <div className="space-y-2">
            {campaigns.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.is_active ? t('common.active') : t('common.inactive')} · {c.is_archived ? t('settings.marketing.archived', { default: 'Archivada' }) : t('settings.marketing.live', { default: 'Vigente' })}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => updateCampaign(c.id, { is_active: !c.is_active })}>
                    {c.is_active ? t('settings.marketing.deactivate', { default: 'Desactivar' }) : t('settings.marketing.activate', { default: 'Activar' })}
                  </Button>
                  <Button variant="outline" onClick={() => updateCampaign(c.id, { is_archived: !c.is_archived })}>
                    {c.is_archived ? t('settings.marketing.unarchive', { default: 'Desarchivar' }) : t('settings.marketing.archive', { default: 'Archivar' })}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


