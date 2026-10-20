import { useState, useCallback, useRef } from 'react';
import type { CaptureSession, Photo, SessionStatus, CaptureMode } from '@/types';
import { saveSession, savePhoto } from '@/services/storage.service';

function generateId(): string {
  // Simple ID without uuid dependency - use crypto.randomUUID if available
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export interface CaptureController {
  session: CaptureSession | null;
  status: SessionStatus;
  currentIndex: number;
  countdown: number;
  isFlashing: boolean;
  startSession: (mode: CaptureMode, count: number) => CaptureSession;
  beginCapture: (
    captureFrame: () => HTMLCanvasElement | null,
    settings: CaptureSettings,
    targetSession?: CaptureSession,
  ) => Promise<void>;
  addPhoto: (canvas: HTMLCanvasElement, sessionId: string, index: number) => Photo;
  retakePhoto: (photoId: string) => void;
  deletePhoto: (photoId: string) => void;
  reorderPhotos: (fromIndex: number, toIndex: number) => void;
  completeSession: () => void;
  cancelSession: () => void;
  resetSession: () => void;
  setStatus: (status: SessionStatus) => void;
}

export interface CaptureSettings {
  countdownSeconds: number;
  delayBetweenShots: number;
  soundEnabled: boolean;
  mirrorCapture: boolean;
  autoAdvance: boolean;
}

export function useCaptureSession(): CaptureController {
  const [session, setSession] = useState<CaptureSession | null>(null);
  const sessionRef = useRef<CaptureSession | null>(null);
  const [status, setStatusState] = useState<SessionStatus>('idle');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [isFlashing, setIsFlashing] = useState(false);
  const isCancelledRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const setStatus = useCallback((s: SessionStatus) => {
    setStatusState(s);
  }, []);

  const startSession = useCallback((mode: CaptureMode, count: number): CaptureSession => {
    const newSession: CaptureSession = {
      id: generateId(),
      mode,
      totalCount: count,
      capturedCount: 0,
      photos: [],
      status: 'preparing',
      createdAt: Date.now(),
    };
    isCancelledRef.current = false;
    sessionRef.current = newSession;
    setSession(newSession);
    setStatusState('preparing');
    setCurrentIndex(0);
    setCountdown(0);
    // Persist initial session state
    saveSession(newSession).catch(console.error);
    return newSession;
  }, []);

  const addPhoto = useCallback((canvas: HTMLCanvasElement, sessionId: string, index: number): Photo => {
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    const photo: Photo = {
      id: generateId(),
      sessionId,
      index,
      dataUrl,
      capturedAt: Date.now(),
      width: canvas.width,
      height: canvas.height,
    };

    if (sessionRef.current && sessionRef.current.id === sessionId) {
      const updatedPhotos = [...sessionRef.current.photos, photo];
      const updated: CaptureSession = {
        ...sessionRef.current,
        photos: updatedPhotos,
        capturedCount: updatedPhotos.length,
      };
      sessionRef.current = updated;
      setSession(updated);
      saveSession(updated).catch(console.error);
    } else {
      setSession((prev) => {
        if (!prev) return prev;
        const updated = {
          ...prev,
          photos: [...prev.photos, photo],
          capturedCount: prev.capturedCount + 1,
        };
        sessionRef.current = updated;
        saveSession(updated).catch(console.error);
        return updated;
      });
    }

    savePhoto(photo).catch(console.error);
    return photo;
  }, []);

  const playBeep = useCallback((countdownVal: number) => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = countdownVal === 0 ? 880 : 440;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.2);
    } catch {
      // Audio not supported or blocked
    }
  }, []);

  const beginCapture = useCallback(async (
    captureFrame: () => HTMLCanvasElement | null,
    settings: CaptureSettings,
    targetSession?: CaptureSession,
  ) => {
    const currentSession = targetSession ?? sessionRef.current ?? session;
    if (!currentSession) return;
    sessionRef.current = currentSession;
    setSession(currentSession);

    isCancelledRef.current = false;
    const { countdownSeconds, delayBetweenShots, soundEnabled, autoAdvance } = settings;

    const captureOne = async (idx: number): Promise<boolean> => {
      if (isCancelledRef.current) return false;

      setStatusState('countdown');
      setCurrentIndex(idx);

      // Countdown
      for (let c = countdownSeconds; c >= 0; c--) {
        if (isCancelledRef.current) return false;
        setCountdown(c);
        if (soundEnabled && c > 0) playBeep(c);
        if (c > 0) {
          await new Promise<void>((resolve) => {
            timerRef.current = setTimeout(resolve, 1000);
          });
        }
      }

      if (isCancelledRef.current) return false;

      // Flash effect
      setStatusState('capturing');
      setIsFlashing(true);
      if (soundEnabled) playBeep(0);
      setTimeout(() => setIsFlashing(false), 300);

      // Brief delay to allow flash render
      await new Promise<void>((resolve) => setTimeout(resolve, 40));

      // Capture frame
      const canvas = captureFrame();
      const active = sessionRef.current ?? currentSession;
      if (canvas && !isCancelledRef.current && active) {
        addPhoto(canvas, active.id, idx);
      }

      setStatusState('reviewing');
      return true;
    };

    // Run capture sequence
    const total = currentSession.totalCount;
    if (autoAdvance) {
      for (let i = 0; i < total; i++) {
        const ok = await captureOne(i);
        if (!ok) break;
        if (i < total - 1) {
          // Delay between shots
          await new Promise<void>((resolve) => {
            timerRef.current = setTimeout(resolve, delayBetweenShots);
          });
        }
      }
    } else {
      const active = sessionRef.current ?? currentSession;
      await captureOne(active.capturedCount);
    }

    // Check if session is complete and save
    const finalSession = sessionRef.current;
    if (finalSession && finalSession.photos.length > 0) {
      setStatusState('reviewing');
      const completed: CaptureSession = {
        ...finalSession,
        status: 'reviewing',
      };
      sessionRef.current = completed;
      setSession(completed);
      await saveSession(completed).catch(console.error);
    }
  }, [session, addPhoto, playBeep]);

  const retakePhoto = useCallback((photoId: string) => {
    setSession((prev) => {
      if (!prev) return prev;
      const updatedPhotos = prev.photos.filter((p) => p.id !== photoId);
      const updated: CaptureSession = {
        ...prev,
        photos: updatedPhotos,
        capturedCount: updatedPhotos.length,
      };
      sessionRef.current = updated;
      saveSession(updated).catch(console.error);
      return updated;
    });
  }, []);

  const deletePhoto = useCallback((photoId: string) => {
    setSession((prev) => {
      if (!prev) return prev;
      const updatedPhotos = prev.photos.filter((p) => p.id !== photoId);
      const updated: CaptureSession = {
        ...prev,
        photos: updatedPhotos,
        capturedCount: updatedPhotos.length,
      };
      sessionRef.current = updated;
      saveSession(updated).catch(console.error);
      return updated;
    });
  }, []);

  const reorderPhotos = useCallback((fromIndex: number, toIndex: number) => {
    setSession((prev) => {
      if (!prev) return prev;
      const photos = [...prev.photos];
      const [moved] = photos.splice(fromIndex, 1);
      photos.splice(toIndex, 0, moved);
      const reindexed = photos.map((p, i) => ({ ...p, index: i }));
      const updated: CaptureSession = { ...prev, photos: reindexed };
      sessionRef.current = updated;
      saveSession(updated).catch(console.error);
      return updated;
    });
  }, []);

  const completeSession = useCallback(() => {
    setStatusState('completed');
    setSession((prev) => {
      if (!prev) return prev;
      const completed: CaptureSession = { ...prev, status: 'completed' as SessionStatus, completedAt: Date.now() };
      sessionRef.current = completed;
      saveSession(completed).catch(console.error);
      return completed;
    });
  }, []);

  const cancelSession = useCallback(() => {
    isCancelledRef.current = true;
    clearTimer();
    setStatusState('cancelled');
    setCountdown(0);
    setIsFlashing(false);
  }, [clearTimer]);

  const resetSession = useCallback(() => {
    isCancelledRef.current = true;
    clearTimer();
    sessionRef.current = null;
    setSession(null);
    setStatusState('idle');
    setCurrentIndex(0);
    setCountdown(0);
    setIsFlashing(false);
  }, [clearTimer]);

  return {
    session,
    status,
    currentIndex,
    countdown,
    isFlashing,
    startSession,
    beginCapture,
    addPhoto,
    retakePhoto,
    deletePhoto,
    reorderPhotos,
    completeSession,
    cancelSession,
    resetSession,
    setStatus,
  };
}
