/**
 * Audio Player Component
 *
 * Plays TTS audio responses from AI
 */

'use client'

import { useState, useRef, useEffect } from 'react'
import { Volume2, VolumeX, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface AudioPlayerProps {
  text: string
  autoPlay?: boolean
  onError?: (error: string) => void
}

export function AudioPlayer({ text, autoPlay = false, onError }: AudioPlayerProps) {
  const t = useTranslations('aiAssistant.audio')
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const handlePlay = async () => {
    if (isPlaying) {
      // Stop current audio
      audioRef.current?.pause()
      audioRef.current = null
      setIsPlaying(false)
      return
    }

    setIsLoading(true)

    try {
      // Call TTS API
      const response = await fetch('/api/ai/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })

      if (!response.ok) {
        throw new Error('TTS failed')
      }

      // Get audio blob
      const audioBlob = await response.blob()
      const audioUrl = URL.createObjectURL(audioBlob)

      // Create and play audio
      const audio = new Audio(audioUrl)
      audioRef.current = audio

      audio.onended = () => {
        setIsPlaying(false)
        URL.revokeObjectURL(audioUrl)
      }

      audio.onerror = () => {
        setIsPlaying(false)
        URL.revokeObjectURL(audioUrl)
        onError?.('Error al reproducir audio')
      }

      await audio.play()
      setIsPlaying(true)
    } catch (error) {
      console.error('[AudioPlayer] Error:', error)
      onError?.('Error al generar voz')
    } finally {
      setIsLoading(false)
    }
  }

  // Auto-play if requested
  useEffect(() => {
    if (autoPlay && !isPlaying && !isLoading) {
      handlePlay()
    }
    // Cleanup on unmount
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <button
      onClick={handlePlay}
      disabled={isLoading}
      className="inline-flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400 hover:underline disabled:opacity-50"
      title={isPlaying ? t('stop') : t('listen')}
    >
      {isLoading ? (
        <>
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>{t('generating')}</span>
        </>
      ) : isPlaying ? (
        <>
          <VolumeX className="h-3 w-3" />
          <span>{t('stop')}</span>
        </>
      ) : (
        <>
          <Volume2 className="h-3 w-3" />
          <span>{t('listen')}</span>
        </>
      )}
    </button>
  )
}
