'use client'

import { useState, useRef, useCallback } from 'react'

interface TTSState {
  playingKey: string | null
  loadingKey: string | null
  errorKey: string | null
}

export function useTTS() {
  const [state, setState] = useState<TTSState>({
    playingKey: null,
    loadingKey: null,
    errorKey: null,
  })
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const objectUrlRef = useRef<string | null>(null)

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.onended = null
      audioRef.current.onerror = null
      audioRef.current = null
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
    setState({ playingKey: null, loadingKey: null, errorKey: null })
  }, [])

  const toggle = useCallback(async (key: string, text: string, model: string) => {
    // If currently playing this key, stop
    if (state.playingKey === key || state.loadingKey === key) {
      stop()
      return
    }

    // Stop any current playback
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.onended = null
      audioRef.current.onerror = null
      audioRef.current = null
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }

    setState({ playingKey: null, loadingKey: key, errorKey: null })

    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, model }),
      })

      if (!response.ok) {
        setState({ playingKey: null, loadingKey: null, errorKey: key })
        return
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      objectUrlRef.current = url

      const audio = new Audio(url)
      audioRef.current = audio

      audio.onended = () => {
        stop()
      }

      audio.onerror = () => {
        setState({ playingKey: null, loadingKey: null, errorKey: key })
      }

      await audio.play()
      setState({ playingKey: key, loadingKey: null, errorKey: null })
    } catch {
      setState({ playingKey: null, loadingKey: null, errorKey: key })
    }
  }, [state.playingKey, state.loadingKey, stop])

  return {
    playingKey: state.playingKey,
    loadingKey: state.loadingKey,
    errorKey: state.errorKey,
    toggle,
    stop,
  }
}
