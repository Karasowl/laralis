'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import { useWorkspace } from '@/contexts/workspace-context'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Loader2, MessageCircle, Search, Send } from 'lucide-react'

type ConversationStatus = 'bot' | 'pending' | 'in_progress' | 'closed'
type ConversationState = 'collecting_name' | 'collecting_email' | 'chatting'
type InboxChannel = 'whatsapp' | 'phone' | 'web' | 'email' | 'other'

interface InboxConversation {
  id: string
  clinic_id: string
  campaign_id: string | null
  lead_id: string | null
  patient_id: string | null
  channel: InboxChannel
  contact_address: string
  contact_name: string | null
  status: ConversationStatus
  conversation_state: ConversationState
  assigned_user_id: string | null
  last_message_at: string | null
  last_message_preview: string | null
  unread_count: number
  created_at: string
  marketing_campaigns?: { id: string; name: string } | null
  leads?: {
    id: string
    full_name: string | null
    phone: string | null
    status: string | null
    converted_patient_id: string | null
  } | null
  patients?: {
    id: string
    first_name: string | null
    last_name: string | null
    phone: string | null
  } | null
}

interface InboxMessage {
  id: string
  conversation_id: string
  role: 'user' | 'assistant' | 'agent' | 'system'
  sender_user_id: string | null
  content: string
  direction: 'inbound' | 'outbound'
  message_type: string | null
  created_at: string
}

const sortConversations = (items: InboxConversation[]) => {
  return [...items].sort((a, b) => {
    const aTime = new Date(a.last_message_at || a.created_at).getTime()
    const bTime = new Date(b.last_message_at || b.created_at).getTime()
    return bTime - aTime
  })
}

export default function InboxClient() {
  const t = useTranslations('inbox')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const { currentClinic, user } = useWorkspace()
  const supabaseRef = useRef<ReturnType<typeof createSupabaseBrowserClient> | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  if (!supabaseRef.current) {
    supabaseRef.current = createSupabaseBrowserClient()
  }

  const supabase = supabaseRef.current

  const [conversations, setConversations] = useState<InboxConversation[]>([])
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<InboxMessage[]>([])
  const [loadingConversations, setLoadingConversations] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [search, setSearch] = useState('')
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const timeFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }),
    [locale]
  )
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }),
    [locale]
  )
  const dateTimeFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
    [locale]
  )

  const statusConfig = useMemo(() => ({
    bot: { label: t('status.bot'), variant: 'secondary' as const },
    pending: { label: t('status.pending'), variant: 'warning' as const },
    in_progress: { label: t('status.in_progress'), variant: 'success' as const },
    closed: { label: t('status.closed'), variant: 'outline' as const, className: 'text-muted-foreground' },
  }), [t])

  const stateLabels = useMemo(() => ({
    collecting_name: t('state.collecting_name'),
    collecting_email: t('state.collecting_email'),
    chatting: t('state.chatting'),
  }), [t])

  const selectedConversation = useMemo(
    () => conversations.find((c) => c.id === selectedConversationId) || null,
    [conversations, selectedConversationId]
  )

  const filteredConversations = useMemo(() => {
    if (!search.trim()) return conversations
    const term = search.toLowerCase()
    return conversations.filter((conversation) => {
      const candidateValues = [
        conversation.contact_name,
        conversation.contact_address,
        conversation.last_message_preview,
        conversation.marketing_campaigns?.name,
        conversation.leads?.full_name,
        conversation.patients
          ? `${conversation.patients.first_name || ''} ${conversation.patients.last_name || ''}`.trim()
          : null,
      ]
      return candidateValues.some((value) => value?.toLowerCase().includes(term))
    })
  }, [conversations, search])

  const formatListTimestamp = useCallback((value?: string | null) => {
    if (!value) return ''
    const date = new Date(value)
    const now = new Date()
    const isSameDay = date.toDateString() === now.toDateString()
    return isSameDay ? timeFormatter.format(date) : dateFormatter.format(date)
  }, [dateFormatter, timeFormatter])

  const formatMessageTimestamp = useCallback((value?: string | null) => {
    if (!value) return ''
    return dateTimeFormatter.format(new Date(value))
  }, [dateTimeFormatter])

  const getConversationTitle = useCallback((conversation: InboxConversation) => {
    const leadName = conversation.leads?.full_name?.trim()
    const contactName = conversation.contact_name?.trim()
    if (leadName) return leadName
    if (contactName) return contactName
    return conversation.contact_address
  }, [])

  const upsertConversation = useCallback((incoming: InboxConversation) => {
    setConversations((prev) => {
      const index = prev.findIndex((c) => c.id === incoming.id)
      const next = [...prev]
      if (index === -1) {
        next.unshift(incoming)
      } else {
        next[index] = { ...prev[index], ...incoming }
      }
      return sortConversations(next)
    })
  }, [])

  const removeConversation = useCallback((conversationId: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== conversationId))
    setMessages((prev) => prev.filter((m) => m.conversation_id !== conversationId))
    setSelectedConversationId((prev) => (prev === conversationId ? null : prev))
  }, [])

  const markConversationRead = useCallback(async (conversationId: string) => {
    try {
      const response = await fetch('/api/inbox/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId }),
      })

      if (!response.ok) {
        throw new Error('Failed to mark conversation as read')
      }

      const { data } = await response.json()
      if (data?.id) {
        upsertConversation(data)
      }
    } catch (error) {
      console.error(error)
    }
  }, [upsertConversation])

  const handleSelectConversation = useCallback((conversation: InboxConversation) => {
    setSelectedConversationId(conversation.id)
    if (conversation.unread_count > 0) {
      markConversationRead(conversation.id)
      setConversations((prev) =>
        prev.map((item) =>
          item.id === conversation.id ? { ...item, unread_count: 0 } : item
        )
      )
    }
  }, [markConversationRead])

  const fetchConversations = useCallback(async () => {
    if (!currentClinic?.id) return
    setLoadingConversations(true)
    try {
      const { data, error } = await supabase
        .from('inbox_conversations')
        .select(`
          id,
          clinic_id,
          campaign_id,
          lead_id,
          patient_id,
          channel,
          contact_address,
          contact_name,
          status,
          conversation_state,
          assigned_user_id,
          last_message_at,
          last_message_preview,
          unread_count,
          created_at,
          marketing_campaigns ( id, name ),
          leads ( id, full_name, phone, status, converted_patient_id ),
          patients ( id, first_name, last_name, phone )
        `)
        .eq('clinic_id', currentClinic.id)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })

      if (error) throw error

      const next = sortConversations((data || []) as InboxConversation[])
      setConversations(next)
      setSelectedConversationId((prev) =>
        prev && next.some((item) => item.id === prev) ? prev : next[0]?.id || null
      )
    } catch (error) {
      console.error(error)
      toast.error(t('errors.loadConversations'))
    } finally {
      setLoadingConversations(false)
    }
  }, [currentClinic?.id, supabase, t])

  const fetchMessages = useCallback(async (conversationId: string) => {
    setLoadingMessages(true)
    try {
      const { data, error } = await supabase
        .from('inbox_messages')
        .select('id, conversation_id, role, sender_user_id, content, direction, message_type, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

      if (error) throw error
      setMessages((data || []) as InboxMessage[])
    } catch (error) {
      console.error(error)
      toast.error(t('errors.loadMessages'))
    } finally {
      setLoadingMessages(false)
    }
  }, [supabase, t])

  const handleSendMessage = useCallback(async () => {
    if (!selectedConversationId || !draft.trim() || sending) return
    setSending(true)
    try {
      const response = await fetch('/api/inbox/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: selectedConversationId,
          content: draft.trim(),
        }),
      })

      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to send message')
      }

      if (payload?.data?.id) {
        setMessages((prev) => {
          if (prev.some((item) => item.id === payload.data.id)) return prev
          return [...prev, payload.data as InboxMessage]
        })
      }

      setDraft('')
    } catch (error: any) {
      console.error(error)
      toast.error(error?.message || t('errors.sendMessage'))
    } finally {
      setSending(false)
    }
  }, [draft, selectedConversationId, sending, t])

  const handleConversationAction = useCallback(async (action: 'assign' | 'toggle-bot' | 'transfer' | 'close') => {
    if (!selectedConversationId) return
    setActionLoading(action)
    try {
      const response = await fetch(`/api/inbox/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: selectedConversationId }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error || t('errors.updateConversation'))
      }

      if (payload?.data?.id) {
        upsertConversation(payload.data)
      }
    } catch (error: any) {
      console.error(error)
      toast.error(error?.message || t('errors.updateConversation'))
    } finally {
      setActionLoading(null)
    }
  }, [selectedConversationId, t, upsertConversation])

  useEffect(() => {
    if (!currentClinic?.id) {
      setConversations([])
      setMessages([])
      setSelectedConversationId(null)
      return
    }
    fetchConversations()
  }, [currentClinic?.id, fetchConversations])

  useEffect(() => {
    if (!currentClinic?.id) return

    const channel = supabase
      .channel(`inbox_conversations:${currentClinic.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inbox_conversations',
          filter: `clinic_id=eq.${currentClinic.id}`,
        },
        (payload: any) => {
          if (payload.eventType === 'DELETE') {
            removeConversation(payload.old?.id)
            return
          }

          if (payload.new?.id) {
            upsertConversation(payload.new as InboxConversation)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentClinic?.id, removeConversation, supabase, upsertConversation])

  useEffect(() => {
    if (!selectedConversationId) {
      setMessages([])
      return
    }

    fetchMessages(selectedConversationId)

    const channel = supabase
      .channel(`inbox_messages:${selectedConversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'inbox_messages',
          filter: `conversation_id=eq.${selectedConversationId}`,
        },
        (payload: any) => {
          if (!payload.new?.id) return
          setMessages((prev) => {
            if (prev.some((item) => item.id === payload.new.id)) return prev
            return [...prev, payload.new as InboxMessage].sort(
              (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            )
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchMessages, selectedConversationId, supabase])

  useEffect(() => {
    setDraft('')
  }, [selectedConversationId])

  useEffect(() => {
    if (!selectedConversation?.unread_count || !selectedConversationId) return
    markConversationRead(selectedConversationId)
  }, [markConversationRead, selectedConversation?.unread_count, selectedConversationId])

  useEffect(() => {
    if (!messagesEndRef.current) return
    messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  if (!currentClinic?.id) {
    return (
      <Card className="p-8">
        <EmptyState
          icon={<MessageCircle />}
          title={tCommon('noClinicContext')}
          description={t('empty.noClinic')}
        />
      </Card>
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <Card className="flex flex-col min-h-[520px] h-[72vh] overflow-hidden">
        <div className="p-4 border-b border-border/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('search.placeholder')}
              className="pl-9"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loadingConversations ? (
            <div className="p-6 flex items-center justify-center text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              {tCommon('loading')}
            </div>
          ) : filteredConversations.length === 0 ? (
            <EmptyState
              icon={<MessageCircle />}
              title={t('empty.title')}
              description={t('empty.description')}
            />
          ) : (
            <div className="divide-y divide-border/50">
              {filteredConversations.map((conversation) => {
                const statusBadge = statusConfig[conversation.status]
                const isSelected = conversation.id === selectedConversationId
                const title = getConversationTitle(conversation)
                const preview = conversation.last_message_preview || t('empty.preview')
                const campaign = conversation.marketing_campaigns?.name

                return (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => handleSelectConversation(conversation)}
                    className={cn(
                      'w-full text-left px-4 py-3 transition-colors hover:bg-muted/50',
                      isSelected && 'bg-muted/70'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">{title}</span>
                          <Badge
                            variant={statusBadge.variant}
                            className={cn('text-[10px] uppercase', statusBadge.className)}
                          >
                            {statusBadge.label}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-1">{preview}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-[10px] text-muted-foreground">
                          {formatListTimestamp(conversation.last_message_at)}
                        </span>
                        {conversation.unread_count > 0 && (
                          <Badge variant="secondary" className="text-[10px] px-2 py-0.5">
                            {conversation.unread_count}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                      {campaign && <span>{t('labels.campaign')}: {campaign}</span>}
                      {conversation.conversation_state !== 'chatting' && (
                        <span>{stateLabels[conversation.conversation_state]}</span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </Card>

      <Card className="flex flex-col min-h-[520px] h-[72vh] overflow-hidden">
        {!selectedConversation ? (
          <EmptyState
            icon={<MessageCircle />}
            title={t('emptyConversation.title')}
            description={t('emptyConversation.description')}
          />
        ) : (
          <>
            <div className="p-4 border-b border-border/50 space-y-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold">
                      {getConversationTitle(selectedConversation)}
                    </h2>
                    <Badge
                      variant={statusConfig[selectedConversation.status].variant}
                      className={cn('text-[10px] uppercase', statusConfig[selectedConversation.status].className)}
                    >
                      {statusConfig[selectedConversation.status].label}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] uppercase">
                      {selectedConversation.channel}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {selectedConversation.contact_address}
                  </div>
                  <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                    {selectedConversation.marketing_campaigns?.name && (
                      <span>{t('labels.campaign')}: {selectedConversation.marketing_campaigns.name}</span>
                    )}
                    {selectedConversation.leads?.status && (
                      <span>{t('labels.lead')}: {selectedConversation.leads.status}</span>
                    )}
                    {selectedConversation.patients?.first_name && (
                      <span>
                        {t('labels.patient')}: {`${selectedConversation.patients.first_name} ${selectedConversation.patients.last_name || ''}`.trim()}
                      </span>
                    )}
                    <span>
                      {selectedConversation.assigned_user_id === user?.id
                        ? t('labels.assignedToYou')
                        : selectedConversation.assigned_user_id
                        ? t('labels.assigned')
                        : t('labels.unassigned')}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleConversationAction('assign')}
                    disabled={selectedConversation.status === 'closed' || actionLoading === 'assign'}
                  >
                    {actionLoading === 'assign' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {selectedConversation.assigned_user_id === user?.id
                      ? t('actions.assigned')
                      : t('actions.assign')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleConversationAction('toggle-bot')}
                    disabled={selectedConversation.status === 'closed' || actionLoading === 'toggle-bot'}
                  >
                    {actionLoading === 'toggle-bot' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {selectedConversation.status === 'bot'
                      ? t('actions.takeOver')
                      : t('actions.resumeBot')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleConversationAction('transfer')}
                    disabled={selectedConversation.status === 'closed' || actionLoading === 'transfer'}
                  >
                    {actionLoading === 'transfer' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t('actions.transfer')}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleConversationAction('close')}
                    disabled={selectedConversation.status === 'closed' || actionLoading === 'close'}
                  >
                    {actionLoading === 'close' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t('actions.close')}
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {loadingMessages ? (
                <div className="flex items-center justify-center text-muted-foreground py-12">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {tCommon('loading')}
                </div>
              ) : messages.length === 0 ? (
                <EmptyState
                  icon={<MessageCircle />}
                  title={t('emptyConversation.noMessages')}
                  description={t('emptyConversation.noMessagesDescription')}
                />
              ) : (
                messages.map((message) => {
                  const isOutbound = message.direction === 'outbound'
                  return (
                    <div
                      key={message.id}
                      className={cn(
                        'flex',
                        isOutbound ? 'justify-end' : 'justify-start'
                      )}
                    >
                      <div
                        className={cn(
                          'max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm',
                          isOutbound
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-foreground'
                        )}
                      >
                        <div className="whitespace-pre-wrap">{message.content}</div>
                        <div className={cn(
                          'mt-1 text-[10px]',
                          isOutbound ? 'text-primary-foreground/70' : 'text-muted-foreground'
                        )}>
                          {formatMessageTimestamp(message.created_at)}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="border-t border-border/50 p-4">
              <div className="flex flex-col gap-3">
                <Textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={t('composer.placeholder')}
                  rows={3}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault()
                      handleSendMessage()
                    }
                  }}
                  disabled={selectedConversation.status === 'closed'}
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {selectedConversation.status === 'closed'
                      ? t('composer.closedNotice')
                      : t('composer.sendHint')}
                  </span>
                  <Button
                    size="sm"
                    onClick={handleSendMessage}
                    disabled={sending || !draft.trim() || selectedConversation.status === 'closed'}
                  >
                    {sending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-2 h-4 w-4" />
                    )}
                    {sending ? tCommon('sending') : t('actions.reply')}
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
