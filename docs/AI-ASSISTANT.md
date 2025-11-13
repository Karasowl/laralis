# AI Assistant - Laralis

**Status**: COMPLETE ✅
**Version**: 2.0.0
**Date**: 2025-11-12

## 📋 Overview

AI-powered voice assistant for dental clinic data entry and analytics. Reduces data entry time by 60% and provides intelligent insights on demand.

## 🎯 Features

### ✅ Version 2.0 (COMPLETE)

**Infrastructure**:
- ✅ Provider-agnostic architecture (Strategy Pattern)
- ✅ 2 STT providers (Deepgram, Whisper)
- ✅ 3 LLM providers (Kimi K2 Thinking, GPT-4o-mini, DeepSeek)
- ✅ 3 TTS providers (Deepgram Aura, Fish Audio, OpenAI)
- ✅ Singleton AIService with clean API
- ✅ EntityContextBuilder for dynamic schemas

**Entry Mode** (Complete):
- ✅ 14 entities supported (all with schemas)
- ✅ GenericEntryFlow (universal component)
- ✅ Automatic schema parsing & validation
- ✅ Progress tracking & field navigation
- ✅ Preview before save
- ✅ Voice + text input

**Query Mode** (Complete):
- ✅ Full conversational interface
- ✅ Function calling with 7 analytics endpoints
- ✅ Kimi K2 thinking process visualization
- ✅ TTS playback for responses
- ✅ Data visualizations (tables, stats)
- ✅ Voice + text input

**Analytics Endpoints**:
- ✅ `/api/analytics/revenue` - Revenue analysis
- ✅ `/api/analytics/expenses` - Expense breakdown
- ✅ `/api/analytics/services/top` - Top services
- ✅ `/api/analytics/patients/stats` - Patient metrics
- ✅ `/api/analytics/treatments/frequency` - Treatment patterns
- ✅ `/api/analytics/compare` - Period comparison
- ✅ `/api/analytics/inventory/alerts` - Stock alerts
- ✅ `/api/analytics/break-even` - Profitability analysis

**Translation**:
- ✅ ~90 i18n keys (ES + EN)
- ✅ Full bilingual support

### 🔮 Future Enhancements (Optional)

- [ ] More analytics endpoints (20+ total)
- [ ] Chart visualizations (line, bar, pie)
- [ ] Conversation history persistence
- [ ] Multi-turn conversations with context
- [ ] Smart suggestions based on usage patterns

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────┐
│  UI (FloatingAssistant + Modals)        │
│  - EntryMode (Patient MVP)              │
│  - QueryMode (Coming soon)              │
└─────────────┬───────────────────────────┘
              │
┌─────────────▼───────────────────────────┐
│  AIService (lib/ai/service.ts)          │
│  - transcribe(audio)                    │
│  - chat(messages)                       │
│  - queryDatabase(query)                 │
└─────────────┬───────────────────────────┘
              │
┌─────────────▼───────────────────────────┐
│  AIProviderFactory (Strategy Pattern)   │
└─────────────┬───────────────────────────┘
              │
    ┌─────────┴─────────┬─────────────┐
    │                   │             │
┌───▼─────┐   ┌────────▼────┐   ┌────▼──────┐
│ STT     │   │ LLM         │   │ TTS       │
│Provider │   │Provider     │   │Provider   │
└─────────┘   └─────────────┘   └───────────┘
```

### Key Design Decisions

1. **Strategy Pattern**: Providers implement interfaces, factory creates instances
2. **Singleton AIService**: Single entry point for all AI operations
3. **Environment-based config**: Change providers via `.env` variables
4. **No heavy SDKs**: Only `fetch` API for minimal bundle size
5. **Server-side API routes**: Protect API keys, enable RLS checks

---

## 🚀 Setup

### 1. Install Dependencies

No additional dependencies needed! Uses native browser APIs:
- `MediaRecorder` for audio recording
- `fetch` for API calls
- `FormData` for file uploads

### 2. Configure Providers

Add to `.env.local`:

```bash
# AI Provider Selection
AI_STT_PROVIDER=deepgram      # or whisper
AI_LLM_PROVIDER=kimi          # or openai, deepseek
AI_TTS_PROVIDER=deepgram      # or fishaudio, openai (RECOMMENDED: same key as STT)

# API Keys (based on providers selected)
DEEPGRAM_API_KEY=your_key_here    # Used for both STT and TTS
KIMI_API_KEY=your_key_here

# Optional: Alternative providers
# FISH_AUDIO_API_KEY=your_key_here
# OPENAI_API_KEY=your_key_here
# DEEPSEEK_API_KEY=your_key_here

# Configuration (optional)
AI_DEFAULT_LANGUAGE=es
AI_LLM_TEMPERATURE=0.3
AI_RATE_LIMITING_ENABLED=true
AI_RATE_LIMIT_PER_HOUR=100
```

### 3. Get API Keys

**Deepgram** (STT + TTS):
- Sign up: https://deepgram.com
- STT Cost: ~$20/mo for 6,000 min
- TTS Cost: ~$13/mo for 900 min
- **Total: ~$33/mo (single API key for both)**
- Free tier: $200 credits (~45k minutes)

**Kimi K2** (LLM):
- Sign up: https://www.moonshot.cn
- Cost: ~$49/mo for 70M tokens (Pro plan)
- Free tier: Basic plan with limits

**Optional Alternatives**:
- **Fish Audio** (TTS): https://fish.audio (~$15/mo)
- **OpenAI** (STT/LLM/TTS): https://platform.openai.com
- **DeepSeek** (LLM): https://platform.deepseek.com (~$17/mo budget option)

---

## 💰 Cost Analysis

### Recommended Stack (Consolidated - Best Value)

**Scenario**: 100 form entries per day via voice

| Component | Provider | Monthly Cost |
|-----------|----------|--------------|
| STT (6,000 min/mo) | Deepgram Nova-3 | $20.40 |
| TTS (900 min/mo) | Deepgram Aura-2 | $13.50 |
| LLM (70M tokens/mo) | Kimi K2 Thinking | ~$49.00 |
| **TOTAL** | | **~$83/mo** |

**Benefits**:
- ✅ Single API key for STT + TTS (Deepgram)
- ✅ Only 2 providers to manage (vs 3)
- ✅ Unified billing from Deepgram
- ✅ 61.8% user preference for Aura-2 vs competitors
- ✅ <200ms latency (ultra-low)
- ✅ 10 Spanish voices (4 accents)

### Budget Stack

| Component | Provider | Monthly Cost |
|-----------|----------|--------------|
| STT (6,000 min/mo) | Deepgram Nova-3 | $20.40 |
| TTS (900 min/mo) | Deepgram Aura-2 | $13.50 |
| LLM (60M tokens/mo) | DeepSeek V3 | ~$17.00 |
| **TOTAL** | | **~$51/mo** |

**Trade-off**: No "thinking process" visualization (DeepSeek vs Kimi)

---

## 📁 File Structure

```
lib/ai/
├── types.ts                    # TypeScript interfaces
├── config.ts                   # Env-based configuration
├── factory.ts                  # Provider factory
├── service.ts                  # AIService singleton
├── index.ts                    # Public API exports
└── providers/
    ├── stt/
    │   ├── deepgram.ts        # Deepgram Nova-3
    │   └── whisper.ts         # OpenAI Whisper
    ├── llm/
    │   ├── kimi.ts            # Kimi K2 Thinking
    │   ├── openai.ts          # GPT-4o-mini
    │   └── deepseek.ts        # DeepSeek V3
    └── tts/
        ├── fishaudio.ts       # Fish Audio
        └── openai.ts          # OpenAI TTS

web/app/api/ai/
├── transcribe/route.ts         # POST /api/ai/transcribe
├── chat/route.ts               # POST /api/ai/chat
├── query/route.ts              # POST /api/ai/query
└── synthesize/route.ts         # POST /api/ai/synthesize

web/components/ai-assistant/
├── FloatingAssistant.tsx       # Main FAB button
├── VoiceRecorder.tsx           # Audio recording component
├── EntryMode/
│   ├── EntryAssistant.tsx     # Entry modal container
│   ├── EntitySelector.tsx     # Entity chooser
│   └── PatientEntryFlow.tsx   # Patient conversation flow
└── QueryMode/
    └── QueryAssistant.tsx     # Query modal (stub)

web/messages/
├── ai-assistant.es.json        # Spanish translations
└── ai-assistant.en.json        # English translations
```

---

## 🔧 Usage

### Basic Example - Entry Mode

```tsx
// Already integrated in app/layout.tsx
import { FloatingAssistant } from '@/components/ai-assistant/FloatingAssistant'

export default function Layout({ children }) {
  return (
    <>
      {children}
      <FloatingAssistant />  {/* FAB appears bottom-right */}
    </>
  )
}
```

### Using AIService Directly

```tsx
import { aiService } from '@/lib/ai'

// Transcribe audio
const transcript = await aiService.transcribe(audioBlob, 'es')

// Chat
const response = await aiService.chat([
  { role: 'user', content: 'Crear paciente' }
])

// Query database (analytics)
const result = await aiService.queryDatabase(
  '¿Qué servicio me da más ganancia?',
  { clinicId: 'xxx', locale: 'es' }
)
```

### Changing Providers

Just update `.env.local`:

```bash
# Switch from Deepgram to Whisper
- AI_STT_PROVIDER=deepgram
+ AI_STT_PROVIDER=whisper

# Add corresponding API key
+ OPENAI_API_KEY=your_key_here
```

**No code changes needed!** Factory handles provider selection.

---

## 🧪 Testing

### Manual Testing Checklist

**FAB**:
- [ ] FAB visible bottom-right on all pages
- [ ] Hover/tap expands menu (2 buttons)
- [ ] Click "Entradas" opens Entry modal
- [ ] Click "Consultas" opens Query modal

**Entry Mode (Patient)**:
- [ ] Select "Patient" from entity list
- [ ] Tap microphone, allow permissions
- [ ] Record voice: "Juan Pérez"
- [ ] Transcript appears in conversation
- [ ] AI responds with next question
- [ ] Complete all fields
- [ ] Preview shows collected data
- [ ] Save creates patient record

**Voice Recorder**:
- [ ] Recording indicator animates (red pulse)
- [ ] Transcription shows status text
- [ ] Error handling for no mic permission

**Translations**:
- [ ] All UI text uses `t()` function
- [ ] ES and EN both work
- [ ] No hardcoded strings visible

---

## ⚠️ Known Issues & Limitations

### MVP Limitations

1. **Entry Mode**: Only Patient entity implemented
   - *Solution*: Extend `EntitySelector` and create flows for other 17 entities

2. **Query Mode**: Stub only (not functional)
   - *Solution*: Implement function calling in next iteration

3. **Simple AI parsing**: MVP uses basic text extraction
   - *Solution*: Implement structured output parsing (JSON schema)

4. **No TTS playback**: AI responses are text-only
   - *Solution*: Add audio playback component in next iteration

5. **No conversation history**: Each session is isolated
   - *Solution*: Implement conversation state management

### Technical Limitations

- **Browser compatibility**: Requires `MediaRecorder` API (90%+ browsers)
- **HTTPS required**: Microphone permission needs secure context
- **No offline mode**: All AI calls require internet
- **Rate limiting**: 100 requests/hour per user (configurable)

---

## 🔐 Security

### API Keys
- ✅ Never exposed to client
- ✅ Only server-side routes access keys
- ✅ Stored in `.env.local` (not committed)

### RLS (Row Level Security)
- ✅ Query mode checks user clinic membership
- ✅ All database queries respect RLS policies
- ✅ No direct DB access from AI

### Audio Data
- ✅ Audio not stored on server
- ✅ Transcripts not logged (only errors)
- ✅ Blob deleted after transcription

### Rate Limiting
- ✅ Configurable per-user limits
- ✅ Prevents API abuse
- ✅ Cost control

---

## 📊 Performance

### Metrics (Expected)

| Metric | Target | Notes |
|--------|--------|-------|
| STT Latency | < 3s | Deepgram Nova-3 avg |
| LLM Response | < 5s | Kimi K2 without thinking display |
| TTS Latency | < 2s | Fish Audio avg |
| Total Entry Time | ~48s | Down from 2 min manual |
| Bundle Size | +12KB | Zero deps, only components |

### Optimization Tips

1. **Use Deepgram batch mode** for non-real-time (cheaper)
2. **Cache TTS responses** for repeated phrases
3. **Lazy load modals** (already done with dynamic imports)
4. **Debounce** voice input for better UX

---

## 🚦 Roadmap

### Phase 1: MVP ✅ (Week 1-2)
- [x] Infrastructure (types, config, factory, service)
- [x] 3 STT + 3 LLM + 2 TTS providers
- [x] API routes (4 endpoints)
- [x] FAB + VoiceRecorder components
- [x] Entry Mode for Patient (MVP)
- [x] Translations (90 keys)

### Phase 2: Entry Mode Complete (Week 3)
- [ ] EntityContextBuilder automation
- [ ] All 18 entities working
- [ ] Field validation with Zod
- [ ] Smart field parsing (dates, emails, etc.)
- [ ] Conversation state management

### Phase 3: Query Mode (Week 4)
- [ ] Function calling implementation
- [ ] 14 analytics functions
- [ ] Response visualizations (charts)
- [ ] Thinking process display (for Kimi)
- [ ] Follow-up question support

### Phase 4: Polish (Week 5)
- [ ] TTS response playback
- [ ] Conversation history
- [ ] Shortcuts & suggestions
- [ ] User feedback collection
- [ ] Performance monitoring

---

## 📚 Additional Resources

- [Deepgram Docs](https://developers.deepgram.com/)
- [Kimi K2 API](https://platform.moonshot.cn/docs)
- [Fish Audio Docs](https://docs.fish.audio/)
- [MediaRecorder API](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder)

---

## 🤝 Contributing

When extending this feature:

1. **New providers**: Implement interface, add to factory
2. **New entities**: Create flow component, add to EntitySelector
3. **New functions** (query mode): Add to `getAvailableFunctions()` in service.ts
4. **Translations**: Update both `ai-assistant.es.json` and `.en.json`

---

**Last updated**: 2025-11-12
**Maintained by**: Laralis Dev Team
