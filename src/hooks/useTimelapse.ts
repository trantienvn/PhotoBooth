import { useState, useCallback, useRef, useEffect } from 'react';
import { TimelapseService, getFileExtension } from '@/services/timelapse.service';
import type { TimelapseState } from '@/types';

const initialState: TimelapseState = {
  status: 'idle',
  duration: 0,
  estimatedSize: 0,
};

export function useTimelapse(stream: MediaStream | null) {
  const [state, setState] = useState<TimelapseState>(initialState);
  const serviceRef = useRef<TimelapseService | null>(null);

  useEffect(() => {
    serviceRef.current = new TimelapseService((partial) => {
      setState((prev) => ({ ...prev, ...partial }));
    });
    return () => {
      serviceRef.current?.destroy();
    };
  }, []);

  const startRecording = useCallback(() => {
    if (!stream || !serviceRef.current) return false;
    return serviceRef.current.start(stream);
  }, [stream]);

  const pauseRecording = useCallback(() => {
    serviceRef.current?.pause();
  }, []);

  const resumeRecording = useCallback(() => {
    serviceRef.current?.resume();
  }, []);

  const stopRecording = useCallback(async () => {
    const result = await serviceRef.current?.stop();
    return result ?? null;
  }, []);

  const downloadVideo = useCallback(() => {
    if (!state.blobUrl || !state.mimeType) return;
    const ext = getFileExtension(state.mimeType);
    const filename = `lumibooth_timelapse_${Date.now()}.${ext}`;
    const a = document.createElement('a');
    a.href = state.blobUrl;
    a.download = filename;
    a.click();
  }, [state.blobUrl, state.mimeType]);

  const reset = useCallback(() => {
    // Revoke old URL
    if (state.blobUrl) {
      URL.revokeObjectURL(state.blobUrl);
    }
    serviceRef.current?.destroy();
    serviceRef.current = new TimelapseService((partial) => {
      setState((prev) => ({ ...prev, ...partial }));
    });
    setState(initialState);
  }, [state.blobUrl]);

  return {
    state,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    downloadVideo,
    reset,
  };
}
