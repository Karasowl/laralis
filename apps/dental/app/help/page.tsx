'use client'

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  HelpCircle,
  BookOpen,
  Mail,
  ExternalLink,
  Keyboard,
  Users,
  TrendingUp,
  Search,
  MessageSquare,
  Clock,
  ChevronRight
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import Link from 'next/link'

const GUIDES = [
  {
    key: 'gettingStarted',
    icon: BookOpen,
    href: '/help/getting-started',
    color: 'from-blue-500 to-blue-600',
    readTime: 5
  },
  {
    key: 'patients',
    icon: Users,
    href: '/help/patients',
    color: 'from-emerald-500 to-emerald-600',
    readTime: 4
  },
  {
    key: 'finances',
    icon: TrendingUp,
    href: '/help/finances',
    color: 'from-amber-500 to-amber-600',
    readTime: 6
  },
  {
    key: 'shortcuts',
    icon: Keyboard,
    href: '/help/shortcuts',
    color: 'from-purple-500 to-purple-600',
    readTime: 2
  },
]

const FAQ_KEYS = [
  'howToAddPatient',
  'howToCreateTreatment',
  'whatIsBreakEven',
  'howToTrackExpenses',
  'howToUseMarketing',
  'howToConfigureTime',
  'whatIsFixedCost',
  'whatIsVariableCost',
  'howToCalculatePrice',
  'canIHaveMultipleClinics',
  'howToInviteStaff',
  'isMyDataSecure',
  'canIExportData',
  'howToUseVoiceAssistant',
  'whatIfINeedHelp',
]

export default function HelpPage() {
  const t = useTranslations('helpPage')
  const [searchQuery, setSearchQuery] = useState('')

  // Filter guides based on search
  const filteredGuides = useMemo(() => {
    if (!searchQuery.trim()) return GUIDES
    const query = searchQuery.toLowerCase()
    return GUIDES.filter(guide => {
      const title = t(`guides.${guide.key}.title`).toLowerCase()
      const description = t(`guides.${guide.key}.description`).toLowerCase()
      return title.includes(query) || description.includes(query)
    })
  }, [searchQuery, t])

  // Filter FAQs based on search
  const filteredFaqs = useMemo(() => {
    if (!searchQuery.trim()) return FAQ_KEYS
    const query = searchQuery.toLowerCase()
    return FAQ_KEYS.filter(faqKey => {
      const question = t(`faq.${faqKey}.question`).toLowerCase()
      const answer = t(`faq.${faqKey}.answer`).toLowerCase()
      return question.includes(query) || answer.includes(query)
    })
  }, [searchQuery, t])

  const hasResults = filteredGuides.length > 0 || filteredFaqs.length > 0

  return (
    <div className="container max-w-4xl py-8 px-4 md:px-6">
      <PageHeader
        title={t('title')}
        description={t('description')}
      />

      {/* Search */}
      <div className="relative mt-6 mb-8">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t('searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {!hasResults && (
        <div className="text-center py-12 text-muted-foreground">
          <HelpCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>{t('noResults')}</p>
        </div>
      )}

      <div className="space-y-8">
        {/* Quick Guides */}
        {filteredGuides.length > 0 && (
          <section>
            <h2 className="text-xl font-semibold mb-4">{t('quickGuides')}</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {filteredGuides.map((guide) => (
                <Link key={guide.key} href={guide.href}>
                  <Card className="hover:shadow-md transition-all cursor-pointer group h-full">
                    <CardHeader className="pb-2">
                      <div className="flex items-start gap-4">
                        <div className={`p-3 rounded-xl bg-gradient-to-r ${guide.color} shrink-0`}>
                          <guide.icon className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-base flex items-center gap-2">
                            {t(`guides.${guide.key}.title`)}
                            <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </CardTitle>
                          <CardDescription className="mt-1">
                            {t(`guides.${guide.key}.description`)}
                          </CardDescription>
                          <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {t('readTime', { minutes: guide.readTime })}
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* FAQ */}
        {filteredFaqs.length > 0 && (
          <section>
            <h2 className="text-xl font-semibold mb-4">{t('faqTitle')}</h2>
            <Card>
              <CardContent className="pt-6">
                <Accordion type="single" collapsible className="w-full">
                  {filteredFaqs.map((faqKey, index) => (
                    <AccordionItem key={faqKey} value={`item-${index}`}>
                      <AccordionTrigger className="text-left">
                        {t(`faq.${faqKey}.question`)}
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground">
                        {t(`faq.${faqKey}.answer`)}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          </section>
        )}

        {/* Contact Support */}
        <section>
          <h2 className="text-xl font-semibold mb-4">{t('needMoreHelp')}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <Mail className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{t('contact.email.title')}</CardTitle>
                    <CardDescription>{t('contact.email.description')}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full" asChild>
                  <a href="mailto:soporte@laralis.com">
                    soporte@laralis.com
                    <ExternalLink className="h-4 w-4 ml-2" />
                  </a>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-500/10">
                    <MessageSquare className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{t('contact.chat.title')}</CardTitle>
                    <CardDescription>{t('contact.chat.description')}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                    {t('contact.chat.available')}
                  </span>
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Version Info */}
        <section className="text-center text-sm text-muted-foreground pt-8 border-t">
          <p>Laralis v1.0.0</p>
          <p className="mt-1">{t('madeWith')}</p>
        </section>
      </div>
    </div>
  )
}
