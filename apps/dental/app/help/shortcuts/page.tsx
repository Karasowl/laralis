'use client'

import { useTranslations } from 'next-intl'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Lightbulb } from 'lucide-react'

interface Shortcut {
  keys: string[]
  action: string
}

const GLOBAL_SHORTCUTS: Shortcut[] = [
  { keys: ['Ctrl', 'K'], action: 'search' },
  { keys: ['Ctrl', 'N'], action: 'newPatient' },
  { keys: ['Ctrl', 'Shift', 'N'], action: 'newTreatment' },
  { keys: ['Ctrl', 'S'], action: 'save' },
  { keys: ['Esc'], action: 'escape' },
]

const NAVIGATION_SHORTCUTS: Shortcut[] = [
  { keys: ['G', 'D'], action: 'dashboard' },
  { keys: ['G', 'P'], action: 'patients' },
  { keys: ['G', 'T'], action: 'treatments' },
]

const ACTION_SHORTCUTS: Shortcut[] = [
  { keys: ['Ctrl', 'L'], action: 'voiceAssistant' },
]

function ShortcutKey({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="px-2 py-1 text-xs font-semibold bg-muted border border-border rounded shadow-sm">
      {children}
    </kbd>
  )
}

function ShortcutRow({ shortcut, t }: { shortcut: Shortcut; t: (key: string) => string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b last:border-0">
      <span className="text-muted-foreground">{t(`shortcutsList.${shortcut.action}`)}</span>
      <div className="flex items-center gap-1">
        {shortcut.keys.map((key, i) => (
          <span key={i} className="flex items-center gap-1">
            <ShortcutKey>{key}</ShortcutKey>
            {i < shortcut.keys.length - 1 && <span className="text-muted-foreground">+</span>}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function ShortcutsGuidePage() {
  const t = useTranslations('helpPage.guides.shortcuts')

  return (
    <div className="container max-w-3xl py-8 px-4 md:px-6">
      <PageHeader
        title={t('title')}
        description={t('description')}
        backHref="/help"
        backLabel={t.raw('backToHelp') || 'Back to Help'}
      />

      <div className="mt-8 space-y-6">
        {/* Intro */}
        <p className="text-lg text-muted-foreground">
          {t('intro')}
        </p>

        {/* Global Shortcuts */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('global')}</CardTitle>
          </CardHeader>
          <CardContent>
            {GLOBAL_SHORTCUTS.map((shortcut, i) => (
              <ShortcutRow key={i} shortcut={shortcut} t={t} />
            ))}
          </CardContent>
        </Card>

        {/* Navigation Shortcuts */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('navigation')}</CardTitle>
          </CardHeader>
          <CardContent>
            {NAVIGATION_SHORTCUTS.map((shortcut, i) => (
              <ShortcutRow key={i} shortcut={shortcut} t={t} />
            ))}
          </CardContent>
        </Card>

        {/* Action Shortcuts */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('actions')}</CardTitle>
          </CardHeader>
          <CardContent>
            {ACTION_SHORTCUTS.map((shortcut, i) => (
              <ShortcutRow key={i} shortcut={shortcut} t={t} />
            ))}
          </CardContent>
        </Card>

        {/* Tip */}
        <Alert className="bg-primary/5 border-primary/20">
          <Lightbulb className="h-4 w-4 text-primary" />
          <AlertDescription className="text-primary">
            {t('tip')}
          </AlertDescription>
        </Alert>
      </div>
    </div>
  )
}
