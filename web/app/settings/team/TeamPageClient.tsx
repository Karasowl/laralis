'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Building2, Mail, Shield } from 'lucide-react';
import { WorkspaceMembersTab } from './components/WorkspaceMembersTab';
import { ClinicMembersTab } from './components/ClinicMembersTab';
import { InvitationsTab } from './components/InvitationsTab';
import { CustomRolesTab } from './components/CustomRolesTab';
import { usePermissions } from '@/hooks/use-permissions';
import { PermissionGate } from '@/components/auth';

export function TeamPageClient() {
  const t = useTranslations('team');
  const [activeTab, setActiveTab] = useState('workspace');
  const { loading } = usePermissions();

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-64 bg-muted animate-pulse rounded-lg" />
        <div className="h-64 bg-muted animate-pulse rounded-lg" />
      </div>
    );
  }

  return (
    <PermissionGate
      permission="team.view"
      fallbackType="message"
      message={t('noAccess')}
    >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="workspace" className="gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">{t('tabs.workspace')}</span>
          </TabsTrigger>
          <TabsTrigger value="clinics" className="gap-2">
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">{t('tabs.clinics')}</span>
          </TabsTrigger>
          <TabsTrigger value="invitations" className="gap-2">
            <Mail className="h-4 w-4" />
            <span className="hidden sm:inline">{t('tabs.invitations')}</span>
          </TabsTrigger>
          <TabsTrigger value="roles" className="gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">{t('tabs.roles')}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="workspace" className="space-y-4">
          <WorkspaceMembersTab />
        </TabsContent>

        <TabsContent value="clinics" className="space-y-4">
          <ClinicMembersTab />
        </TabsContent>

        <TabsContent value="invitations" className="space-y-4">
          <InvitationsTab />
        </TabsContent>

        <TabsContent value="roles" className="space-y-4">
          <CustomRolesTab />
        </TabsContent>
      </Tabs>
    </PermissionGate>
  );
}
