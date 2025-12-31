'use client'

import { useTranslations } from 'next-intl'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  HelpCircle,
  BookOpen,
  MessageSquare,
  Mail,
  ExternalLink,
  Keyboard,
  FileQuestion
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

export default function HelpPage() {
  const t = useTranslations('helpPage')

  const faqs = [
    { question: t('faq.howToAddPatient.question'), answer: t('faq.howToAddPatient.answer') },
    { question: t('faq.howToCreateTreatment.question'), answer: t('faq.howToCreateTreatment.answer') },
    { question: t('faq.whatIsBreakEven.question'), answer: t('faq.whatIsBreakEven.answer') },
    { question: t('faq.howToTrackExpenses.question'), answer: t('faq.howToTrackExpenses.answer') },
    { question: t('faq.howToUseMarketing.question'), answer: t('faq.howToUseMarketing.answer') },
  ]

  const quickGuides = [
    { title: t('guides.gettingStarted'), icon: BookOpen, href: '#' },
    { title: t('guides.managingPatients'), icon: HelpCircle, href: '#' },
    { title: t('guides.financialReports'), icon: FileQuestion, href: '#' },
    { title: t('guides.keyboardShortcuts'), icon: Keyboard, href: '#' },
  ]

  return (
    <div className="container max-w-4xl py-8 px-4 md:px-6">
      <PageHeader
        title={t('title')}
        description={t('description')}
      />

      <div className="space-y-8 mt-8">
        {/* Quick Guides */}
        <section>
          <h2 className="text-xl font-semibold mb-4">{t('quickGuides')}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {quickGuides.map((guide, index) => (
              <Card key={index} className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <guide.icon className="h-5 w-5 text-primary" />
                    </div>
                    <CardTitle className="text-base">{guide.title}</CardTitle>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section>
          <h2 className="text-xl font-semibold mb-4">{t('faqTitle')}</h2>
          <Card>
            <CardContent className="pt-6">
              <Accordion type="single" collapsible className="w-full">
                {faqs.map((faq, index) => (
                  <AccordionItem key={index} value={`item-${index}`}>
                    <AccordionTrigger className="text-left">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </section>

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
                <Button variant="outline" className="w-full" disabled>
                  {t('contact.chat.comingSoon')}
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Version Info */}
        <section className="text-center text-sm text-muted-foreground pt-8 border-t">
          <p>Laralis v0.3.0</p>
          <p className="mt-1">{t('madeWith')}</p>
        </section>
      </div>
    </div>
  )
}
