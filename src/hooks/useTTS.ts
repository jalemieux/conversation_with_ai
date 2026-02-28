'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

interface TTSState {
  playingKey: string | null
  loadingKey: string | null
  errorKey: string | null
  pausedKey: string | null
  currentTime: number
  duration: number
}

export function useTTS() {
  const [state, setState] = useState<TTSState>({
    playingKey: null,
    loadingKey: null,
    errorKey: null,
    pausedKey: null,
    currentTime: 0,
    duration: 0,
  })
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const objectUrlRef = useRef<string | null>(null)
  const rafRef = useRef<number | null>(null)

  const stopProgressTracking = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  const startProgressTracking = useCallback(() => {
    stopProgressTracking()
    const tick = () => {
      const audio = audioRef.current
      if (audio) {
        setState(prev => ({
          ...prev,
          currentTime: audio.currentTime,
          duration: isNaN(audio.duration) ? 0 : audio.duration,
        }))
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [stopProgressTracking])

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopProgressTracking()
    }
  }, [stopProgressTracking])

  const stop = useCallback(() => {
    stopProgressTracking()
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
    setState({ playingKey: null, loadingKey: null, errorKey: null, pausedKey: null, currentTime: 0, duration: 0 })
  }, [stopProgressTracking])

  const toggle = useCallback(async (
    key: string,
    text: string,
    model: string,
    conversationId?: string,
    round?: number,
  ) => {
    // If currently playing this key, stop
    if (state.playingKey === key || state.loadingKey === key) {
      stop()
      return
    }

    // If this key is paused, resume it
    if (state.pausedKey === key && audioRef.current) {
      await audioRef.current.play()
      startProgressTracking()
      setState(prev => ({ ...prev, playingKey: key, pausedKey: null }))
      return
    }

    // Stop any current playback
    stopProgressTracking()
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

    setState({ playingKey: null, loadingKey: key, errorKey: null, pausedKey: null, currentTime: 0, duration: 0 })

    try {
      const body: Record<string, unknown> = { text, model }
      if (conversationId !== undefined) body.conversationId = conversationId
      if (round !== undefined) body.round = round

      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        setState(prev => ({ ...prev, playingKey: null, loadingKey: null, errorKey: key }))
        return
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      objectUrlRef.current = url

      const audio = new Audio(url)
      audioRef.current = audio

      audio.onended = () => {
        stopProgressTracking()
        setState(prev => ({ ...prev, playingKey: null, pausedKey: prev.playingKey, currentTime: prev.duration }))
      }

      audio.onerror = () => {
        stopProgressTracking()
        setState(prev => ({ ...prev, playingKey: null, loadingKey: null, errorKey: key }))
      }

      await audio.play()
      startProgressTracking()
      setState(prev => ({ ...prev, playingKey: key, loadingKey: null, errorKey: null }))
    } catch {
      stopProgressTracking()
      setState(prev => ({ ...prev, playingKey: null, loadingKey: null, errorKey: key }))
    }
  }, [state.playingKey, state.loadingKey, state.pausedKey, stop, startProgressTracking, stopProgressTracking])

  const pauseToggle = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return

    if (state.playingKey) {
      // Currently playing -> pause
      audio.pause()
      stopProgressTracking()
      setState(prev => ({ ...prev, pausedKey: prev.playingKey, playingKey: null }))
    } else if (state.pausedKey) {
      // Currently paused -> resume
      audio.play()
      startProgressTracking()
      setState(prev => ({ ...prev, playingKey: prev.pausedKey, pausedKey: null }))
    }
  }, [state.playingKey, state.pausedKey, startProgressTracking, stopProgressTracking])

  const skipForward = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = Math.min(audio.currentTime + 10, audio.duration || 0)
  }, [])

  const skipBack = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = Math.max(audio.currentTime - 10, 0)
  }, [])

  const seek = useCallback((time: number) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = time
  }, [])

  return {
    playingKey: state.playingKey,
    loadingKey: state.loadingKey,
    errorKey: state.errorKey,
    pausedKey: state.pausedKey,
    currentTime: state.currentTime,
    duration: state.duration,
    toggle,
    stop,
    pauseToggle,
    skipForward,
    skipBack,
    seek,
  }
}
