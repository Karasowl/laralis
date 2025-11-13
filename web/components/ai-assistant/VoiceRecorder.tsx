/**
 * Voice Recorder Component
 *
 * Records audio from microphone and sends to transcription API
 */

'use client'

import { useState, useRef, useCallback } from 'react'
import { Mic, Square } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface VoiceRecorderProps {
  onTranscript: (text: string) => void
  onError?: (error: string) => void
  disabled?: boolean
  language?: string
}

type RecordingState = 'idle' | 'recording' | 'transcribing'

export function VoiceRecorder({
  onTranscript,
  onError,
  disabled = false,
  language = 'es',
}: VoiceRecorderProps) {
  const t = useTranslations('aiAssistant.entry')
  const [state, setState] = useState<RecordingState>('idle')
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const startRecording = useCallback(async () => {
    try {
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      // Collect audio chunks
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      // Handle recording stop
      mediaRecorder.onstop = async () => {
        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop())

        // Create blob from chunks
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' })

        // Transcribe
        await transcribeAudio(audioBlob)
      }

      // Start recording
      mediaRecorder.start()
      setState('recording')
    } catch (error) {
      console.error('[VoiceRecorder] Error starting recording:', error)
      onError?.(
        error instanceof Error && error.name === 'NotAllowedError'
          ? t('errors.microphonePermission')
          : t('errors.noAudioRecorded')
      )
    }
  }, [language, onError, t])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
      setState('transcribing')
    }
  }, [])

  const transcribeAudio = async (audioBlob: Blob) => {
    try {
      setState('transcribing')

      // Send to transcription API
      const formData = new FormData()
      formData.append('audio', audioBlob, 'recording.webm')
      formData.append('language', language)

      const response = await fetch('/api/ai/transcribe', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Transcription failed')
      }

      const data = await response.json()

      if (data.transcript) {
        onTranscript(data.transcript)
      } else {
        throw new Error('No transcript returned')
      }
    } catch (error) {
      console.error('[VoiceRecorder] Transcription error:', error)
      onError?.(t('errors.transcriptionFailed'))
    } finally {
      setState('idle')
    }
  }

  const isRecording = state === 'recording'
  const isTranscribing = state === 'transcribing'
  const isIdle = state === 'idle'

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Record Button */}
      <button
        onClick={isRecording ? stopRecording : startRecording}
        disabled={disabled || isTranscribing}
        className={`relative flex items-center justify-center w-16 h-16 rounded-full transition-all ${
          isRecording
            ? 'bg-red-500 hover:bg-red-600 animate-pulse'
            : isTranscribing
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 hover:scale-110'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
        aria-label={isRecording ? t('stopRecording') : t('speak')}
      >
        {isRecording ? (
          <Square className="h-6 w-6 text-white" />
        ) : (
          <Mic className="h-7 w-7 text-white" />
        )}

        {/* Recording indicator ring */}
        {isRecording && (
          <span className="absolute inset-0 rounded-full border-4 border-red-300 animate-ping" />
        )}
      </button>

      {/* Status Text */}
      <p className="text-sm font-medium text-muted-foreground">
        {isRecording && t('recording')}
        {isTranscribing && t('transcribing')}
        {isIdle && t('tapToSpeak')}
      </p>
    </div>
  )
}
