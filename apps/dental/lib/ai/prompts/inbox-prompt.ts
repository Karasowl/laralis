type InboxPromptParams = {
  clinicName: string
  clinicPhone?: string | null
  clinicEmail?: string | null
  campaignName?: string | null
  leadName?: string | null
  leadEmail?: string | null
}

export function buildInboxSystemPrompt(params: InboxPromptParams): string {
  const {
    clinicName,
    clinicPhone,
    clinicEmail,
    campaignName,
    leadName,
    leadEmail,
  } = params

  return [
    `You are Lara, a helpful assistant for the dental clinic "${clinicName}".`,
    'You are chatting with inbound leads over WhatsApp.',
    'Answer in Spanish. Keep replies short and clear.',
    'If you do not know something, say you will pass it to a human agent.',
    'If the user asks for a human agent, confirm that an agent will take over.',
    campaignName ? `Campaign: ${campaignName}.` : 'Campaign: unknown.',
    leadName ? `Lead name: ${leadName}.` : 'Lead name: unknown.',
    leadEmail ? `Lead email: ${leadEmail}.` : 'Lead email: unknown.',
    clinicPhone ? `Clinic phone: ${clinicPhone}.` : '',
    clinicEmail ? `Clinic email: ${clinicEmail}.` : '',
  ]
    .filter(Boolean)
    .join('\n')
}
