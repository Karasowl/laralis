'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Info, Sparkles, Check, AlertCircle, Trash2, Shield, Palette, Zap, FileText } from 'lucide-react';
import packageJson from '@/package.json';

const iconMap = {
  added: Sparkles,
  improved: Zap,
  fixed: Check,
  removed: Trash2,
  security: Shield,
  ui: Palette,
  performance: Zap,
  documentation: FileText,
};

export function VersionBadge() {
  const [open, setOpen] = useState(false);
  const t = useTranslations('version');
  const version = packageJson.version;

  // Get releases data from i18n
  // Using underscores instead of dots to avoid IntlError with nested keys
  const releases = ['v0_2_0', 'v0_1_0'];
  const releaseVersions = ['0.2.0', '0.1.0']; // For display purposes

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground gap-1.5"
      >
        <Info className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">v</span>
        <span>{version}</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              {t('title')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Current Version */}
            <div className="flex items-center justify-between p-4 rounded-lg bg-primary/5 border border-primary/20">
              <div>
                <p className="text-sm text-muted-foreground">{t('current')}</p>
                <p className="text-2xl font-bold text-primary">v{version}</p>
              </div>
              <Badge className="bg-primary/10 text-primary hover:bg-primary/20">
                {t('whatsNew')}
              </Badge>
            </div>

            {/* Releases */}
            <div className="space-y-6">
              {releases.map((releaseKey, index) => {
                const displayVersion = releaseVersions[index];
                const release = {
                  date: t(`releases.${releaseKey}.date`),
                  title: t(`releases.${releaseKey}.title`),
                };

                // Get all change types that exist for this release
                const changeTypes = ['added', 'improved', 'fixed', 'removed', 'ui', 'security'];

                return (
                  <div key={releaseKey} className="space-y-3">
                    <div className="flex items-baseline gap-3">
                      <h3 className="text-lg font-semibold">
                        v{displayVersion}
                      </h3>
                      <span className="text-sm text-muted-foreground">
                        {release.date}
                      </span>
                    </div>

                    <p className="text-sm font-medium text-foreground/80">
                      {release.title}
                    </p>

                    <div className="space-y-4">
                      {changeTypes.map((type) => {
                        const changes = t.raw(`releases.${releaseKey}.${type}`);

                        if (!changes || (Array.isArray(changes) && changes.length === 0)) {
                          return null;
                        }

                        const Icon = iconMap[type as keyof typeof iconMap] || Info;
                        const changeList = Array.isArray(changes) ? changes : [changes];

                        return (
                          <div key={type} className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4 text-primary" />
                              <h4 className="text-sm font-semibold capitalize">
                                {t(`types.${type}`)}
                              </h4>
                            </div>
                            <ul className="ml-6 space-y-1">
                              {changeList.map((change, idx) => (
                                <li key={idx} className="text-sm text-muted-foreground list-disc">
                                  {change}
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })}
                    </div>

                    {releaseKey !== releases[releases.length - 1] && (
                      <hr className="mt-6 border-border" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Close button */}
            <div className="flex justify-end pt-4">
              <Button onClick={() => setOpen(false)}>
                {t('close')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
