import { useRef, useEffect, useCallback, useState, type RefObject } from 'react';
import { CameraService } from '@/services/camera.service';
import type { CameraSettings, CameraDevice, CameraCapabilities, BeautySettings, FilterSettings } from '@/types';

export type CameraState =
  | 'idle'
  | 'requesting'
  | 'active'
  | 'error'
  | 'stopped'
  | 'unavailable';

export interface UseCameraReturn {
  videoRef: RefObject<HTMLVideoElement>;
  state: CameraState;
  error: string | null;
  devices: CameraDevice[];
  capabilities: CameraCapabilities | null;
  isSecureContext: boolean;
  startCamera: (settings: CameraSettings) => Promise<void>;
  stopCamera: () => Promise<void>;
  captureFrame: (mirror: boolean, beauty?: BeautySettings, filterSettings?: FilterSettings) => HTMLCanvasElement | null;
  switchCamera: (deviceId: string) => Promise<void>;
  refreshDevices: () => Promise<void>;
}

export function useCamera(): UseCameraReturn {
  const videoRef = useRef<HTMLVideoElement>(null);
  const serviceRef = useRef<CameraService>(new CameraService());
  const settingsRef = useRef<CameraSettings | null>(null);

  const [state, setState] = useState<CameraState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<CameraDevice[]>([]);
  const [capabilities, setCapabilities] = useState<CameraCapabilities | null>(null);
  const isSecureContext = CameraService.isSecureContext();

  const refreshDevices = useCallback(async () => {
    const devs = await CameraService.listCameras();
    setDevices(devs);
  }, []);

  const startCamera = useCallback(async (settings: CameraSettings) => {
    setState('requesting');
    setError(null);
    settingsRef.current = settings;

    try {
      const stream = await serviceRef.current.start(settings);
      if (videoRef.current) {
        serviceRef.current.attachToVideo(videoRef.current);
        videoRef.current.play().catch(() => {/* autoplay may be blocked */});
      }
      const caps = CameraService.getCapabilities(stream);
      setCapabilities(caps);
      setState('active');
      // Enumerate devices after permission granted (labels appear)
      await refreshDevices();
    } catch (err) {
      const e = err as Error;
      let msg = 'Camera unavailable.';
      if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
        msg = 'Camera permission denied. Please allow camera access in your browser settings.';
      } else if (e.name === 'NotFoundError' || e.name === 'DevicesNotFoundError') {
        msg = 'No camera found on this device.';
      } else if (e.name === 'NotReadableError' || e.name === 'TrackStartError') {
        msg = 'Camera is in use by another application.';
      } else if (e.name === 'OverconstrainedError') {
        msg = 'Camera does not support the requested resolution.';
      } else {
        msg = e.message || msg;
      }
      setError(msg);
      setState('error');
    }
  }, [refreshDevices]);

  const stopCamera = useCallback(async () => {
    await serviceRef.current.stop();
    setState('stopped');
  }, []);

  const captureFrame = useCallback((mirror: boolean, beauty?: BeautySettings, filterSettings?: FilterSettings): HTMLCanvasElement | null => {
    const video = videoRef.current;
    if (!video || state !== 'active') return null;
    return CameraService.captureFrame(video, mirror, undefined, undefined, beauty, filterSettings);
  }, [state]);

  const switchCamera = useCallback(async (deviceId: string) => {
    if (!settingsRef.current) return;
    const newSettings = { ...settingsRef.current, deviceId };
    await startCamera(newSettings);
  }, [startCamera]);

  // Cleanup on unmount
  useEffect(() => {
    const service = serviceRef.current;
    return () => {
      service.stop();
    };
  }, []);

  return {
    videoRef,
    state,
    error,
    devices,
    capabilities,
    isSecureContext,
    startCamera,
    stopCamera,
    captureFrame,
    switchCamera,
    refreshDevices,
  };
}
