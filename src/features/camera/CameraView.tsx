import { useEffect, useCallback, useState, useMemo, useRef } from 'react';
import {
  Camera, CameraOff, RefreshCw,
  Grid, FlipHorizontal, ChevronDown, ChevronUp, AlertTriangle, Square,
  Sparkles, Wand2, Palette, X, RotateCcw, Smile, Film, Download
} from 'lucide-react';
import { useCamera } from '@/hooks/useCamera';
import { useCaptureSession } from '@/hooks/useCaptureSession';
import { useTimelapse } from '@/hooks/useTimelapse';
import { useAppContext } from '@/app/AppContext';
import type { CaptureMode, CaptureSession, BeautySettings, FilterPresetName, DetectedFace } from '@/types';
import { defaultBeautySettings, defaultCropState, defaultFilterSettings } from '@/types';
import { saveSession } from '@/services/storage.service';
import { formatDuration } from '@/services/export.service';
import {
  filterPresets,
  beautyPresets,
  autoEnhanceSettings,
  getCameraLiveCssFilter
} from '@/services/image-processing.service';
import { globalFaceTracker } from '@/services/face-tracking.service';
import { arFiltersList, renderArFilter, renderFaceBeauty } from '@/services/ar-filters.service';
import { lutPresets, generateLutStripAsset } from '@/services/lut.service';
import { CaptureControls } from '@/features/capture/CaptureControls';
import { ThumbnailStrip } from '@/features/capture/ThumbnailStrip';

export function CameraView() {
  const { settings, updateSettings, setCurrentSession, setView, toast, t, setEditState } = useAppContext();
  const camera = useCamera();
  const capture = useCaptureSession();
  const [showGrid, setShowGrid] = useState(settings.camera.showGrid);
  const [mirror, setMirror] = useState(settings.camera.mirror);
  const [deviceSelectOpen, setDeviceSelectOpen] = useState(false);

  // In-preview quick capture controls
  const [previewMode, setPreviewMode] = useState<CaptureMode>('photobooth');
  const [previewCount, setPreviewCount] = useState<number>(settings.defaultPhotoCount || 4);

  // Live Beauty, Retouch & Filter State
  const [beauty, setBeauty] = useState<BeautySettings>({ ...defaultBeautySettings });
  const [selectedFilter, setSelectedFilter] = useState<FilterPresetName>('original');
  const [activeTray, setActiveTray] = useState<'none' | 'beauty' | 'filters' | 'ar' | 'lut'>('none');
  const [isAutoEnhanced, setIsAutoEnhanced] = useState(false);

  // AR & Multi-Face Tracking Refs
  const arCanvasRef = useRef<HTMLCanvasElement>(null);
  const detectedFacesRef = useRef<DetectedFace[]>([]);
  const [faceCount, setFaceCount] = useState(0);
  const animFrameIdRef = useRef<number | null>(null);

  // Current active preset settings
  const activePreset = useMemo(
    () => filterPresets.find((p) => p.id === selectedFilter),
    [selectedFilter]
  );

  // Live CSS filter for preview video
  const liveVideoFilter = useMemo(
    () => getCameraLiveCssFilter(activePreset?.settings, beauty),
    [activePreset, beauty]
  );

  useEffect(() => {
    setMirror(settings.camera.mirror);
  }, [settings.camera.mirror]);

  useEffect(() => {
    setShowGrid(settings.camera.showGrid);
  }, [settings.camera.showGrid]);

  // Real-time Multi-Face Tracking and AR Rendering Loop
  useEffect(() => {
    let active = true;

    const trackAndRenderLoop = async () => {
      if (!active) return;
      const video = camera.videoRef.current;
      const canvas = arCanvasRef.current;

      if (camera.state === 'active' && video && video.readyState >= 2 && canvas) {
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth || 1280;
          canvas.height = video.videoHeight || 720;
        }

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          if (beauty.faceTracking !== false) {
            try {
              const faces = await globalFaceTracker.detectAll(video);
              detectedFacesRef.current = faces;
              setFaceCount(faces.length);

              if (faces.length > 0) {
                // 1. Render face-targeted skin smoothing & cheek blush for all faces
                if (beauty.enabled && (beauty.smooth > 0 || beauty.rosyGlow > 0)) {
                  renderFaceBeauty(ctx, faces, canvas.width, canvas.height, beauty);
                }

                // 2. Render AR accessories / filters on all faces
                if (beauty.arFilter && beauty.arFilter !== 'none') {
                  renderArFilter(ctx, faces, canvas.width, canvas.height, beauty.arFilter);
                }
              }
            } catch {
              // Frame dropped or busy
            }
          }
        }
      }

      animFrameIdRef.current = requestAnimationFrame(trackAndRenderLoop);
    };

    if (camera.state === 'active') {
      animFrameIdRef.current = requestAnimationFrame(trackAndRenderLoop);
    }

    return () => {
      active = false;
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [camera.state, beauty, camera.videoRef]);

  const timelapse = useTimelapse(camera.state === 'active' ? camera.videoRef.current?.srcObject as MediaStream | null : null);

  const handleStartCamera = useCallback(async () => {
    await camera.startCamera(settings.camera);
  }, [camera, settings.camera]);

  const handleStopCamera = useCallback(async () => {
    await camera.stopCamera();
  }, [camera]);

  const handleToggleAutoEnhance = () => {
    if (isAutoEnhanced) {
      setBeauty({ ...defaultBeautySettings });
      setIsAutoEnhanced(false);
      toast(t('camera.resetBeauty'), 'info');
    } else {
      setBeauty({ ...autoEnhanceSettings });
      setIsAutoEnhanced(true);
      toast(t('camera.autoEnhance') + ' ✨', 'success');
    }
  };

  const handleSelectBeautyPreset = (presetId: 'off' | 'natural' | 'rosy' | 'porcelain' | 'korean') => {
    const p = beautyPresets.find((b) => b.id === presetId);
    if (!p) return;
    setBeauty({ ...p.settings });
    setIsAutoEnhanced(presetId !== 'off');
  };

  const updateBeautyField = (field: keyof BeautySettings, value: number) => {
    setBeauty((prev) => ({
      ...prev,
      enabled: true,
      [field]: value,
      presetId: undefined,
    }));
  };

  const handleCapture = useCallback(async (mode: CaptureMode, count: number) => {
    if (camera.state !== 'active') {
      toast(t('camera.startCamera') + '…', 'error');
      return;
    }
    const newSession = capture.startSession(mode, count);
    setCurrentSession(newSession);

    // Auto-start timelapse by default if idle/stopped
    let didStartTimelapse = false;
    const stream = camera.videoRef.current?.srcObject as MediaStream | null;
    if (stream && (timelapse.state.status === 'idle' || timelapse.state.status === 'stopped')) {
      timelapse.startRecording();
      didStartTimelapse = true;
    }

    const captureFrame = () => camera.captureFrame(
      settings.mirrorCapture,
      beauty,
      activePreset?.settings,
      detectedFacesRef.current.length > 0 ? detectedFacesRef.current : undefined
    );
    await capture.beginCapture(captureFrame, {
      countdownSeconds: settings.countdownSeconds,
      delayBetweenShots: settings.delayBetweenShots,
      soundEnabled: settings.soundEnabled,
      mirrorCapture: settings.mirrorCapture,
      autoAdvance: true,
    }, newSession);

    // Stop timelapse if recording and attach to session
    let finalVideoUrl: string | undefined;
    let finalVideoBlob: Blob | undefined;
    if (didStartTimelapse || timelapse.state.status === 'recording') {
      try {
        const videoRes = await timelapse.stopRecording();
        if (videoRes) {
          finalVideoUrl = videoRes.url;
          finalVideoBlob = videoRes.blob;
        }
      } catch (err) {
        console.error('Error stopping timelapse:', err);
      }
    }

    // Now update and save the complete session with photos + timelapse
    const currentSessionPhotos = capture.session?.photos ?? [];
    if (currentSessionPhotos.length > 0) {
      // Pre-set photo edit states with chosen filter preset
      currentSessionPhotos.forEach((photo) => {
        setEditState(photo.id, {
          filter: activePreset ? { ...activePreset.settings } : defaultFilterSettings,
          crop: defaultCropState,
          presetId: selectedFilter,
        });
      });

      const completedSession: CaptureSession = {
        ...(capture.session ?? newSession),
        photos: currentSessionPhotos,
        status: 'reviewing',
        timelapseUrl: finalVideoUrl,
        timelapseBlob: finalVideoBlob,
      };
      setCurrentSession(completedSession);
      await saveSession(completedSession).catch(console.error);
      toast(t('camera.capturedSuccess'), 'success');
      setView('editor');
    }
  }, [camera, capture, settings, setCurrentSession, timelapse, toast, t, setView, beauty, activePreset, selectedFilter, setEditState]);

  const handleSingleCapture = useCallback(() => {
    handleCapture('single', 1);
  }, [handleCapture]);

  const toggleMirror = () => {
    const newVal = !mirror;
    setMirror(newVal);
    updateSettings({ camera: { ...settings.camera, mirror: newVal } });
  };

  const toggleGrid = () => {
    const newVal = !showGrid;
    setShowGrid(newVal);
    updateSettings({ camera: { ...settings.camera, showGrid: newVal } });
  };

  const [showMobileControls, setShowMobileControls] = useState(false);

  const handleFlipCamera = async () => {
    if (camera.devices.length > 1) {
      const currentIdx = camera.devices.findIndex((d) => d.deviceId === settings.camera.deviceId);
      const nextDev = camera.devices[(currentIdx + 1) % camera.devices.length];
      await camera.switchCamera(nextDev.deviceId);
      updateSettings({ camera: { ...settings.camera, deviceId: nextDev.deviceId } });
      toast(nextDev.label || 'Đổi camera', 'info');
    } else {
      const nextFacing = settings.camera.facing === 'environment' ? 'user' : 'environment';
      const nextMirror = nextFacing === 'user';
      setMirror(nextMirror);
      updateSettings({ camera: { ...settings.camera, facing: nextFacing, mirror: nextMirror } });
      await camera.startCamera({ ...settings.camera, facing: nextFacing, mirror: nextMirror });
      toast(nextFacing === 'user' ? 'Camera trước' : 'Camera sau', 'info');
    }
  };

  const isCapturing = capture.status === 'countdown' || capture.status === 'capturing';

  return (
    <div className="flex h-full w-full" style={{ flex: 1, width: '100%', height: '100%', overflow: 'hidden' }}>
      {/* Sidebar: capture controls (Desktop only) */}
      <div className="app-sidebar desktop-only" style={{ width: 'var(--sidebar-w)', minWidth: 'var(--sidebar-w)', flexShrink: 0 }}>
        <CaptureControls
          onCapture={handleCapture}
          onSingleCapture={handleSingleCapture}
          disabled={camera.state !== 'active' || isCapturing}
          settings={settings}
          updateSettings={updateSettings}
          captureStatus={capture.status}
          capturedCount={capture.session?.capturedCount ?? 0}
          totalCount={capture.session?.totalCount ?? 0}
          onCancel={capture.cancelSession}
          onReset={capture.resetSession}
          timelapse={timelapse}
          cameraStream={camera.state === 'active' ? (camera.videoRef.current?.srcObject as MediaStream | null) : null}
        />
      </div>

      {/* Mobile Capture Controls Modal */}
      {showMobileControls && (
        <div
          className="mobile-only"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(10px)',
            zIndex: 1100,
            display: 'flex',
            alignItems: 'flex-end',
          }}
          onClick={() => setShowMobileControls(false)}
        >
          <div
            style={{
              width: '100%',
              maxHeight: '85vh',
              overflowY: 'auto',
              background: 'var(--surface-card)',
              borderTopLeftRadius: 'var(--radius-xl)',
              borderTopRightRadius: 'var(--radius-xl)',
              padding: '16px',
              borderTop: '1px solid var(--border-subtle)',
              boxShadow: 'var(--shadow-xl)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>📸 {t('controls.mode')}</div>
              <button
                className="btn btn-icon btn-ghost"
                onClick={() => setShowMobileControls(false)}
              >
                <X size={18} />
              </button>
            </div>
            <CaptureControls
              onCapture={(m, c) => { setShowMobileControls(false); handleCapture(m, c); }}
              onSingleCapture={() => { setShowMobileControls(false); handleSingleCapture(); }}
              disabled={camera.state !== 'active' || isCapturing}
              settings={settings}
              updateSettings={updateSettings}
              captureStatus={capture.status}
              capturedCount={capture.session?.capturedCount ?? 0}
              totalCount={capture.session?.totalCount ?? 0}
              onCancel={capture.cancelSession}
              onReset={capture.resetSession}
              timelapse={timelapse}
              cameraStream={camera.state === 'active' ? (camera.videoRef.current?.srcObject as MediaStream | null) : null}
            />
          </div>
        </div>
      )}

      {/* Main: camera preview */}
      <div className="app-main" style={{ position: 'relative', flex: 1, width: '100%', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Top toolbar */}
        <div className="flex items-center justify-between" style={{
          padding: '8px 16px',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--surface-elevated)',
          width: '100%',
          flexShrink: 0,
          gap: 8,
          flexWrap: 'wrap',
        }}>
          <div className="flex items-center gap-2">
            {/* Camera status */}
            <div className={`badge ${camera.state === 'active' ? 'badge-active' : ''}`} style={{
              background: camera.state === 'active' ? '#dcfce7' : 'var(--neutral-100)',
              color: camera.state === 'active' ? '#15803d' : 'var(--text-tertiary)',
            }}>
              <div style={{
                width: 7, height: 7,
                borderRadius: '50%',
                background: camera.state === 'active' ? '#22c55e' : 'var(--neutral-400)',
              }} />
              {camera.state === 'active' ? t('camera.live') : camera.state === 'requesting' ? t('camera.starting') : t('camera.cameraOff')}
            </div>

            {/* Timelapse status */}
            {timelapse.state.status === 'recording' && (
              <div className="badge badge-recording">
                <div className="recording-dot" />
                {t('camera.rec')} {formatDuration(timelapse.state.duration)}
              </div>
            )}

            {/* Multi-Face tracking indicator badge */}
            {camera.state === 'active' && beauty.faceTracking !== false && faceCount > 0 && (
              <div
                className="badge"
                style={{
                  background: 'rgba(236, 72, 153, 0.12)',
                  color: '#db2777',
                  border: '1px solid rgba(236, 72, 153, 0.25)',
                  fontWeight: 600,
                  fontSize: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                👥 {faceCount}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {/* Flip Camera Button (Always visible on mobile, switches device or facing) */}
            {camera.state === 'active' && (
              <button
                id="flip-camera-btn"
                className="btn btn-icon btn-secondary"
                onClick={handleFlipCamera}
                title="Đổi camera trước/sau (Flip camera)"
                aria-label="Flip camera"
              >
                <RotateCcw size={15} />
              </button>
            )}

            {/* Mobile capture settings drawer button */}
            <button
              className="btn btn-secondary mobile-only"
              style={{ fontSize: 12, padding: '4px 8px', gap: 4 }}
              onClick={() => setShowMobileControls(true)}
              title={t('camera.settings') || 'Cài đặt'}
            >
              <Sliders size={14} />
              <span>{t('controls.mode') || 'Chế độ'}</span>
            </button>

            {/* Camera device selector (Desktop) */}
            {camera.devices.length > 1 && (
              <div className="desktop-only" style={{ position: 'relative' }}>
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: 12, padding: '4px 10px' }}
                  onClick={() => setDeviceSelectOpen((o) => !o)}
                >
                  <Camera size={14} />
                  {t('camera.switchCamera')}
                  {deviceSelectOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
                {deviceSelectOpen && (
                  <div className="card" style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    zIndex: 100,
                    minWidth: 200,
                    marginTop: 4,
                    overflow: 'hidden',
                  }}>
                    {camera.devices.map((dev) => (
                      <button
                        key={dev.deviceId}
                        className="btn btn-ghost w-full"
                        style={{ justifyContent: 'flex-start', borderRadius: 0, fontSize: 13 }}
                        onClick={() => {
                          camera.switchCamera(dev.deviceId);
                          setDeviceSelectOpen(false);
                        }}
                      >
                        <Camera size={13} />
                        {dev.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Mirror toggle */}
            <button
              id="toggle-mirror"
              className={`btn btn-icon ${mirror ? 'btn-primary' : 'btn-secondary'}`}
              onClick={toggleMirror}
              title={t('camera.toggleMirror')}
              aria-label={t('camera.toggleMirror')}
            >
              <FlipHorizontal size={16} />
            </button>

            {/* Grid toggle */}
            <button
              id="toggle-grid"
              className={`btn btn-icon ${showGrid ? 'btn-primary' : 'btn-secondary'}`}
              onClick={toggleGrid}
              title={t('camera.toggleGrid')}
              aria-label={t('camera.toggleGrid')}
            >
              <Grid size={16} />
            </button>

            {/* Start/Stop camera */}
            {camera.state !== 'active' ? (
              <button
                id="start-camera"
                className="btn btn-primary"
                style={{ padding: '6px 14px', fontSize: 13 }}
                onClick={handleStartCamera}
                disabled={camera.state === 'requesting'}
              >
                {camera.state === 'requesting' ? (
                  <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> {t('camera.starting')}</>
                ) : (
                  <><Camera size={15} /> {t('camera.startCamera')}</>
                )}
              </button>
            ) : (
              <button
                id="stop-camera"
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: 13 }}
                onClick={handleStopCamera}
              >
                <CameraOff size={15} />
                <span className="desktop-only">{t('camera.stopCamera')}</span>
              </button>
            )}
          </div>
        </div>

        {/* Camera preview area */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '8px 12px',
          overflow: 'hidden',
          width: '100%',
          height: '100%',
          position: 'relative',
        }}>
          {camera.state === 'error' ? (
            <PermissionError message={camera.error} onRetry={handleStartCamera} isSecure={camera.isSecureContext} />
          ) : camera.state === 'idle' || camera.state === 'stopped' ? (
            <StartPrompt onStart={handleStartCamera} />
          ) : (
            <div
              className="camera-container"
              style={{
                position: 'relative',
                width: '100%',
                maxWidth: 880,
                maxHeight: 'calc(100vh - var(--header-h) - 180px)',
                aspectRatio: '4/3',
                boxShadow: 'var(--shadow-xl)',
                margin: 'auto',
                overflow: 'hidden',
                borderRadius: 'var(--radius-xl)',
              }}
            >
              <video
                ref={camera.videoRef}
                id="camera-preview"
                autoPlay
                playsInline
                muted
                className={`camera-video ${mirror ? 'mirror' : ''}`}
                style={{
                  background: '#000',
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  filter: liveVideoFilter,
                  transition: 'filter 0.15s ease',
                }}
              />

              {/* Live AR Accessories & Face Beauty Tracking Canvas */}
              <canvas
                ref={arCanvasRef}
                id="camera-ar-canvas"
                className={`camera-video ${mirror ? 'mirror' : ''}`}
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  pointerEvents: 'none',
                  zIndex: 10,
                }}
              />

              {/* Fallback skin smoothing overlay when face tracking is disabled */}
              {beauty.enabled && beauty.faceTracking === false && beauty.smooth > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    backdropFilter: `blur(${Math.max(0.4, (beauty.smooth / 100) * 1.8).toFixed(1)}px)`,
                    WebkitBackdropFilter: `blur(${Math.max(0.4, (beauty.smooth / 100) * 1.8).toFixed(1)}px)`,
                    opacity: Math.min(0.65, (beauty.smooth / 100) * 0.65),
                    mixBlendMode: 'screen',
                    pointerEvents: 'none',
                    borderRadius: 'inherit',
                  }}
                />
              )}

              {/* Fallback rosy skin glow overlay when face tracking is disabled */}
              {beauty.enabled && beauty.faceTracking === false && beauty.rosyGlow > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'radial-gradient(ellipse at center, rgba(255, 175, 195, 0.42) 0%, rgba(255, 130, 160, 0.18) 60%, transparent 100%)',
                    opacity: Math.min(0.85, (beauty.rosyGlow / 100) * 0.85),
                    mixBlendMode: 'soft-light',
                    pointerEvents: 'none',
                    borderRadius: 'inherit',
                  }}
                />
              )}

              {/* Grid overlay */}
              {showGrid && camera.state === 'active' && (
                <div className="camera-grid-overlay">
                  <div className="camera-grid-line grid-v1" />
                  <div className="camera-grid-line grid-v2" />
                  <div className="camera-grid-line grid-h1" />
                  <div className="camera-grid-line grid-h2" />
                </div>
              )}

              {/* Countdown overlay */}
              {capture.status === 'countdown' && capture.countdown > 0 && (
                <div className="countdown-overlay" role="status" aria-live="assertive">
                  <div className="countdown-number" key={capture.countdown}>
                    {capture.countdown}
                  </div>
                </div>
              )}

              {/* Flash overlay */}
              {capture.isFlashing && (
                <div className="flash-overlay" aria-hidden="true" />
              )}

              {/* Session progress indicator */}
              {capture.session && isCapturing && (
                <div style={{
                  position: 'absolute',
                  top: 16,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'rgba(0,0,0,0.65)',
                  backdropFilter: 'blur(8px)',
                  color: 'white',
                  padding: '6px 18px',
                  borderRadius: 99,
                  fontSize: 13,
                  fontWeight: 600,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                  zIndex: 20,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', animation: 'pulse 1s infinite' }} />
                  {t('camera.shotProgress', { current: capture.session.capturedCount + 1, total: capture.session.totalCount })}
                </div>
              )}

              {/* TOP FLOATING TOOLBAR: AUTO ENHANCE, BEAUTY, FILTERS */}
              {camera.state === 'active' && !isCapturing && (
                <div
                  className="camera-top-tray no-scrollbar touch-scroll-x"
                  style={{
                    position: 'absolute',
                    top: 12,
                    right: 12,
                    zIndex: 30,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    maxWidth: 'calc(100% - 24px)',
                    overflowX: 'auto',
                  }}
                >
                  {/* 1-Tap Auto Enhance Button */}
                  <button
                    onClick={handleToggleAutoEnhance}
                    className={`btn ${isAutoEnhanced ? 'btn-primary' : 'btn-secondary'}`}
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      padding: '6px 14px',
                      borderRadius: 99,
                      background: isAutoEnhanced
                        ? 'linear-gradient(135deg, #ec4899, #8b5cf6)'
                        : 'rgba(15, 23, 42, 0.65)',
                      color: 'white',
                      backdropFilter: 'blur(12px)',
                      WebkitBackdropFilter: 'blur(12px)',
                      border: isAutoEnhanced
                        ? '1px solid rgba(255,255,255,0.5)'
                        : '1px solid rgba(255,255,255,0.2)',
                      boxShadow: isAutoEnhanced ? '0 0 16px rgba(236,72,153,0.5)' : 'none',
                      cursor: 'pointer',
                    }}
                    title={t('camera.autoEnhanceDesc')}
                  >
                    <Wand2 size={13} />
                    {t('camera.autoEnhance')}
                  </button>

                  {/* Beauty & Retouch Toggle */}
                  <button
                    onClick={() => setActiveTray((prev) => (prev === 'beauty' ? 'none' : 'beauty'))}
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      padding: '6px 14px',
                      borderRadius: 99,
                      background: activeTray === 'beauty' || (beauty.enabled && beauty.smooth > 0)
                        ? 'linear-gradient(135deg, #f43f5e, #fb7185)'
                        : 'rgba(15, 23, 42, 0.65)',
                      color: 'white',
                      backdropFilter: 'blur(12px)',
                      WebkitBackdropFilter: 'blur(12px)',
                      border: activeTray === 'beauty' || (beauty.enabled && beauty.smooth > 0)
                        ? '1px solid rgba(255,255,255,0.5)'
                        : '1px solid rgba(255,255,255,0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      cursor: 'pointer',
                    }}
                  >
                    <Sparkles size={13} />
                    {t('camera.beauty')}
                    {beauty.enabled && beauty.smooth > 0 && (
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />
                    )}
                  </button>

                  {/* AR Accessories & Face Props Toggle */}
                  <button
                    onClick={() => setActiveTray((prev) => (prev === 'ar' ? 'none' : 'ar'))}
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      padding: '6px 14px',
                      borderRadius: 99,
                      background: activeTray === 'ar' || (beauty.arFilter && beauty.arFilter !== 'none')
                        ? 'linear-gradient(135deg, #10b981, #06b6d4)'
                        : 'rgba(15, 23, 42, 0.65)',
                      color: 'white',
                      backdropFilter: 'blur(12px)',
                      WebkitBackdropFilter: 'blur(12px)',
                      border: activeTray === 'ar' || (beauty.arFilter && beauty.arFilter !== 'none')
                        ? '1px solid rgba(255,255,255,0.5)'
                        : '1px solid rgba(255,255,255,0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      cursor: 'pointer',
                      boxShadow: beauty.arFilter && beauty.arFilter !== 'none' ? '0 0 16px rgba(16, 185, 129, 0.45)' : 'none',
                    }}
                  >
                    <Smile size={13} />
                    {beauty.arFilter && beauty.arFilter !== 'none'
                      ? (arFiltersList.find((a) => a.id === beauty.arFilter)?.name ?? 'AR')
                      : t('camera.arFilters')}
                  </button>

                  {/* 3D Film LUTs Toggle */}
                  <button
                    onClick={() => setActiveTray((prev) => (prev === 'lut' ? 'none' : 'lut'))}
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      padding: '6px 14px',
                      borderRadius: 99,
                      background: activeTray === 'lut' || (beauty.lutId && beauty.lutId !== 'none')
                        ? 'linear-gradient(135deg, #f59e0b, #ef4444)'
                        : 'rgba(15, 23, 42, 0.65)',
                      color: 'white',
                      backdropFilter: 'blur(12px)',
                      WebkitBackdropFilter: 'blur(12px)',
                      border: activeTray === 'lut' || (beauty.lutId && beauty.lutId !== 'none')
                        ? '1px solid rgba(255,255,255,0.5)'
                        : '1px solid rgba(255,255,255,0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      cursor: 'pointer',
                      boxShadow: beauty.lutId && beauty.lutId !== 'none' ? '0 0 16px rgba(245, 158, 11, 0.45)' : 'none',
                    }}
                  >
                    <Film size={13} />
                    {beauty.lutId && beauty.lutId !== 'none'
                      ? (lutPresets.find((l) => l.id === beauty.lutId)?.badge ?? 'LUT')
                      : (t('camera.lut') || 'LUT')}
                  </button>

                  {/* Live Color Filters Toggle */}
                  <button
                    onClick={() => setActiveTray((prev) => (prev === 'filters' ? 'none' : 'filters'))}
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      padding: '6px 14px',
                      borderRadius: 99,
                      background: activeTray === 'filters' || selectedFilter !== 'original'
                        ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                        : 'rgba(15, 23, 42, 0.65)',
                      color: 'white',
                      backdropFilter: 'blur(12px)',
                      WebkitBackdropFilter: 'blur(12px)',
                      border: activeTray === 'filters' || selectedFilter !== 'original'
                        ? '1px solid rgba(255,255,255,0.5)'
                        : '1px solid rgba(255,255,255,0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      cursor: 'pointer',
                    }}
                  >
                    <Palette size={13} />
                    {selectedFilter === 'original'
                      ? t('camera.filters')
                      : (activePreset?.name ?? selectedFilter)}
                  </button>
                </div>
              )}

              {/* BEAUTY & RETOUCH DRAWER */}
              {activeTray === 'beauty' && camera.state === 'active' && !isCapturing && (
                <div
                  className="camera-drawer-mobile touch-scroll-y"
                  style={{
                    position: 'absolute',
                    bottom: 100,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 'calc(100% - 32px)',
                    maxWidth: 540,
                    background: 'rgba(15, 23, 42, 0.90)',
                    backdropFilter: 'blur(24px)',
                    WebkitBackdropFilter: 'blur(24px)',
                    border: '1px solid rgba(255, 255, 255, 0.25)',
                    borderRadius: 'var(--radius-xl)',
                    padding: '16px 20px',
                    color: 'white',
                    zIndex: 35,
                    boxShadow: '0 20px 48px rgba(0,0,0,0.6)',
                    maxHeight: 330,
                    overflowY: 'auto',
                  }}
                >
                  <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
                    <div className="flex items-center gap-2">
                      <Sparkles size={16} color="#fb7185" />
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{t('camera.beauty')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setBeauty({ ...autoEnhanceSettings });
                          setIsAutoEnhanced(true);
                        }}
                        className="btn btn-ghost"
                        style={{ fontSize: 11, padding: '4px 8px', color: '#fb7185' }}
                        title={t('camera.autoEnhance')}
                      >
                        <Wand2 size={12} />
                        {t('camera.autoEnhance')}
                      </button>
                      <button
                        onClick={() => {
                          setBeauty({ ...defaultBeautySettings });
                          setIsAutoEnhanced(false);
                        }}
                        className="btn btn-ghost"
                        style={{ fontSize: 11, padding: '4px 8px', color: 'rgba(255,255,255,0.7)' }}
                        title={t('camera.resetBeauty')}
                      >
                        <RotateCcw size={12} />
                        {t('camera.resetBeauty')}
                      </button>
                      <button
                        onClick={() => setActiveTray('none')}
                        className="btn btn-icon"
                        style={{ width: 26, height: 26, color: 'rgba(255,255,255,0.7)' }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Face Tracking Toggle Banner */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-md)',
                      background: 'rgba(255, 255, 255, 0.08)',
                      marginBottom: 12,
                    }}
                  >
                    <div style={{ fontSize: 12 }}>
                      <div style={{ fontWeight: 600 }}>👤 {t('camera.faceTracking')}</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{t('camera.faceTrackingDesc')}</div>
                    </div>
                    <button
                      onClick={() => {
                        setBeauty((prev) => ({
                          ...prev,
                          faceTracking: !prev.faceTracking,
                        }));
                      }}
                      style={{
                        width: 38,
                        height: 22,
                        borderRadius: 99,
                        background: beauty.faceTracking !== false ? '#fb7185' : 'rgba(255,255,255,0.2)',
                        position: 'relative',
                        border: 'none',
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          top: 2,
                          left: beauty.faceTracking !== false ? 18 : 2,
                          width: 18,
                          height: 18,
                          borderRadius: '50%',
                          background: 'white',
                          transition: 'left 0.2s',
                        }}
                      />
                    </button>
                  </div>

                  {/* Beauty Presets */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginBottom: 6, fontWeight: 600 }}>
                      {t('camera.beautyStyles')}
                    </div>
                    <div className="flex items-center gap-2" style={{ overflowX: 'auto', paddingBottom: 4 }}>
                      {beautyPresets.map((bp) => (
                        <button
                          key={bp.id}
                          onClick={() => handleSelectBeautyPreset(bp.id)}
                          style={{
                            fontSize: 12,
                            padding: '5px 12px',
                            borderRadius: 99,
                            border: beauty.presetId === bp.id
                              ? '1px solid #fb7185'
                              : '1px solid rgba(255,255,255,0.15)',
                            background: beauty.presetId === bp.id
                              ? 'rgba(244, 63, 94, 0.3)'
                              : 'rgba(255,255,255,0.08)',
                            color: 'white',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <span>{bp.icon}</span>
                          <span>{bp.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Sliders */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
                    <div>
                      <div className="flex justify-between" style={{ fontSize: 12, marginBottom: 4 }}>
                        <span>🫧 {t('camera.smooth')}</span>
                        <span style={{ color: '#fb7185', fontWeight: 600 }}>{beauty.smooth}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={beauty.smooth}
                        onChange={(e) => updateBeautyField('smooth', Number(e.target.value))}
                        style={{ width: '100%', accentColor: '#fb7185' }}
                      />
                    </div>

                    <div>
                      <div className="flex justify-between" style={{ fontSize: 12, marginBottom: 4 }}>
                        <span>🌸 {t('camera.rosyGlow')}</span>
                        <span style={{ color: '#fb7185', fontWeight: 600 }}>{beauty.rosyGlow}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={beauty.rosyGlow}
                        onChange={(e) => updateBeautyField('rosyGlow', Number(e.target.value))}
                        style={{ width: '100%', accentColor: '#fb7185' }}
                      />
                    </div>

                    <div>
                      <div className="flex justify-between" style={{ fontSize: 12, marginBottom: 4 }}>
                        <span>☀️ {t('camera.brighten')}</span>
                        <span style={{ color: '#fb7185', fontWeight: 600 }}>{beauty.brighten}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={beauty.brighten}
                        onChange={(e) => updateBeautyField('brighten', Number(e.target.value))}
                        style={{ width: '100%', accentColor: '#fb7185' }}
                      />
                    </div>

                    <div>
                      <div className="flex justify-between" style={{ fontSize: 12, marginBottom: 4 }}>
                        <span>⚖️ {t('camera.contrast')}</span>
                        <span style={{ color: '#fb7185', fontWeight: 600 }}>{beauty.contrast > 0 ? `+${beauty.contrast}` : beauty.contrast}</span>
                      </div>
                      <input
                        type="range"
                        min="-50"
                        max="50"
                        value={beauty.contrast}
                        onChange={(e) => updateBeautyField('contrast', Number(e.target.value))}
                        style={{ width: '100%', accentColor: '#fb7185' }}
                      />
                    </div>

                    <div style={{ gridColumn: 'span 2' }}>
                      <div className="flex justify-between" style={{ fontSize: 12, marginBottom: 4 }}>
                        <span>🌡️ {t('camera.warmth')}</span>
                        <span style={{ color: '#fb7185', fontWeight: 600 }}>{beauty.warmth > 0 ? `+${beauty.warmth}` : beauty.warmth}</span>
                      </div>
                      <input
                        type="range"
                        min="-50"
                        max="50"
                        value={beauty.warmth}
                        onChange={(e) => updateBeautyField('warmth', Number(e.target.value))}
                        style={{ width: '100%', accentColor: '#fb7185' }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* AR ACCESSORIES & FILTERS DRAWER */}
              {activeTray === 'ar' && camera.state === 'active' && !isCapturing && (
                <div
                  className="camera-drawer-mobile touch-scroll-y"
                  style={{
                    position: 'absolute',
                    bottom: 100,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 'calc(100% - 32px)',
                    maxWidth: 620,
                    background: 'rgba(15, 23, 42, 0.90)',
                    backdropFilter: 'blur(24px)',
                    WebkitBackdropFilter: 'blur(24px)',
                    border: '1px solid rgba(255, 255, 255, 0.25)',
                    borderRadius: 'var(--radius-xl)',
                    padding: '16px 20px',
                    color: 'white',
                    zIndex: 35,
                    boxShadow: '0 20px 48px rgba(0,0,0,0.6)',
                    maxHeight: 330,
                    overflowY: 'auto',
                  }}
                >
                  <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
                    <div className="flex items-center gap-2">
                      <Smile size={16} color="#34d399" />
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{t('camera.arFilters')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setBeauty((prev) => ({
                            ...prev,
                            arFilter: 'none',
                          }));
                        }}
                        className="btn btn-ghost"
                        style={{ fontSize: 11, padding: '4px 8px', color: 'rgba(255,255,255,0.7)' }}
                      >
                        <RotateCcw size={12} />
                        {t('camera.resetBeauty')}
                      </button>
                      <button
                        onClick={() => setActiveTray('none')}
                        className="btn btn-icon"
                        style={{ width: 26, height: 26, color: 'rgba(255,255,255,0.7)' }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Face Tracking Toggle Banner */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-md)',
                      background: 'rgba(255, 255, 255, 0.08)',
                      marginBottom: 14,
                    }}
                  >
                    <div style={{ fontSize: 12 }}>
                      <div style={{ fontWeight: 600 }}>👤 {t('camera.faceTracking')}</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{t('camera.faceTrackingDesc')}</div>
                    </div>
                    <button
                      onClick={() => {
                        setBeauty((prev) => ({
                          ...prev,
                          faceTracking: !prev.faceTracking,
                        }));
                      }}
                      style={{
                        width: 38,
                        height: 22,
                        borderRadius: 99,
                        background: beauty.faceTracking !== false ? '#10b981' : 'rgba(255,255,255,0.2)',
                        position: 'relative',
                        border: 'none',
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          top: 2,
                          left: beauty.faceTracking !== false ? 18 : 2,
                          width: 18,
                          height: 18,
                          borderRadius: '50%',
                          background: 'white',
                          transition: 'left 0.2s',
                        }}
                      />
                    </button>
                  </div>

                  {/* AR Filters Grid / Carousel */}
                  <div
                    className="flex items-center gap-3"
                    style={{
                      overflowX: 'auto',
                      paddingBottom: 8,
                      scrollbarWidth: 'thin',
                    }}
                  >
                    {arFiltersList.map((item) => {
                      const isSelected = (beauty.arFilter ?? 'none') === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            setBeauty((prev) => ({
                              ...prev,
                              enabled: true,
                              faceTracking: true,
                              arFilter: item.id,
                            }));
                          }}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 6,
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            flexShrink: 0,
                            padding: '4px',
                          }}
                          title={item.description}
                        >
                          <div
                            style={{
                              width: 54,
                              height: 54,
                              borderRadius: 16,
                              background: isSelected
                                ? 'linear-gradient(135deg, #10b981, #06b6d4)'
                                : 'rgba(255, 255, 255, 0.1)',
                              border: isSelected ? '3px solid #34d399' : '1px solid rgba(255,255,255,0.2)',
                              boxShadow: isSelected ? '0 0 16px rgba(52, 211, 153, 0.6)' : 'none',
                              transform: isSelected ? 'scale(1.08)' : 'scale(1)',
                              transition: 'all 0.15s ease',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 26,
                            }}
                          >
                            {item.icon}
                          </div>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: isSelected ? 700 : 500,
                              color: isSelected ? '#34d399' : 'rgba(255,255,255,0.8)',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {item.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* LIVE FILTERS DRAWER */}
              {activeTray === 'filters' && camera.state === 'active' && !isCapturing && (
                <div
                  className="camera-drawer-mobile touch-scroll-y"
                  style={{
                    position: 'absolute',
                    bottom: 100,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 'calc(100% - 32px)',
                    maxWidth: 620,
                    background: 'rgba(15, 23, 42, 0.90)',
                    backdropFilter: 'blur(24px)',
                    WebkitBackdropFilter: 'blur(24px)',
                    border: '1px solid rgba(255, 255, 255, 0.25)',
                    borderRadius: 'var(--radius-xl)',
                    padding: '14px 18px',
                    color: 'white',
                    zIndex: 35,
                    boxShadow: '0 20px 48px rgba(0,0,0,0.6)',
                  }}
                >
                  <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
                    <div className="flex items-center gap-2">
                      <Palette size={16} color="#818cf8" />
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{t('camera.liveFilters')}</span>
                    </div>
                    <button
                      onClick={() => setActiveTray('none')}
                      className="btn btn-icon"
                      style={{ width: 26, height: 26, color: 'rgba(255,255,255,0.7)' }}
                    >
                      <X size={14} />
                    </button>
                  </div>

                  <div
                    className="flex items-center gap-3"
                    style={{
                      overflowX: 'auto',
                      paddingBottom: 8,
                      scrollbarWidth: 'thin',
                    }}
                  >
                    {filterPresets.map((preset) => {
                      const isSelected = selectedFilter === preset.id;
                      const gradientBg =
                        preset.id === 'bw'
                          ? 'linear-gradient(135deg, #333, #aaa)'
                          : preset.id === 'warm'
                          ? 'linear-gradient(135deg, #f97316, #fde68a)'
                          : preset.id === 'cool'
                          ? 'linear-gradient(135deg, #38bdf8, #818cf8)'
                          : preset.id === 'vintage'
                          ? 'linear-gradient(135deg, #a16207, #fef3c7)'
                          : preset.id === 'pastel'
                          ? 'linear-gradient(135deg, #f472b6, #c084fc)'
                          : preset.id === 'korean'
                          ? 'linear-gradient(135deg, #fbcfe8, #fed7aa)'
                          : preset.id === 'cinematic'
                          ? 'linear-gradient(135deg, #0f172a, #0284c7)'
                          : preset.id === 'soft'
                          ? 'linear-gradient(135deg, #fed7aa, #fef08a)'
                          : preset.id === 'natural'
                          ? 'linear-gradient(135deg, #86efac, #fde047)'
                          : 'linear-gradient(135deg, #64748b, #cbd5e1)';

                      return (
                        <button
                          key={preset.id}
                          onClick={() => setSelectedFilter(preset.id)}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 6,
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            flexShrink: 0,
                            padding: '4px',
                          }}
                        >
                          <div
                            style={{
                              width: 52,
                              height: 52,
                              borderRadius: 14,
                              background: gradientBg,
                              border: isSelected ? '3px solid #818cf8' : '2px solid rgba(255,255,255,0.2)',
                              boxShadow: isSelected ? '0 0 14px rgba(129, 140, 248, 0.6)' : 'none',
                              transform: isSelected ? 'scale(1.08)' : 'scale(1)',
                              transition: 'all 0.15s ease',
                            }}
                          />
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: isSelected ? 700 : 500,
                              color: isSelected ? '#818cf8' : 'rgba(255,255,255,0.8)',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {preset.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 3D LUT COLOR GRADING DRAWER */}
              {activeTray === 'lut' && camera.state === 'active' && !isCapturing && (
                <div
                  className="camera-drawer-mobile touch-scroll-y"
                  style={{
                    position: 'absolute',
                    bottom: 100,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 'calc(100% - 32px)',
                    maxWidth: 640,
                    background: 'rgba(15, 23, 42, 0.92)',
                    backdropFilter: 'blur(24px)',
                    WebkitBackdropFilter: 'blur(24px)',
                    border: '1px solid rgba(255, 255, 255, 0.25)',
                    borderRadius: 'var(--radius-xl)',
                    padding: '16px 20px',
                    color: 'white',
                    zIndex: 35,
                    boxShadow: '0 20px 48px rgba(0,0,0,0.6)',
                    maxHeight: 340,
                    overflowY: 'auto',
                  }}
                >
                  <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
                    <div className="flex items-center gap-2">
                      <Film size={16} color="#f59e0b" />
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{t('camera.lutPresets')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {beauty.lutId && beauty.lutId !== 'none' && (
                        <button
                          onClick={() => {
                            const url = generateLutStripAsset(beauty.lutId!);
                            if (url) {
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `lut_${beauty.lutId}.png`;
                              a.click();
                              toast(t('camera.lutExportAsset') + ' ✓', 'success');
                            }
                          }}
                          className="btn btn-ghost"
                          style={{ fontSize: 11, padding: '4px 8px', color: '#fbbf24' }}
                          title={t('camera.lutExportAsset')}
                        >
                          <Download size={12} />
                          PNG Asset
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setBeauty((prev) => ({
                            ...prev,
                            lutId: 'none',
                            lutIntensity: 100,
                          }));
                        }}
                        className="btn btn-ghost"
                        style={{ fontSize: 11, padding: '4px 8px', color: 'rgba(255,255,255,0.7)' }}
                      >
                        <RotateCcw size={12} />
                        {t('editor.reset')}
                      </button>
                      <button
                        onClick={() => setActiveTray('none')}
                        className="btn btn-icon"
                        style={{ width: 26, height: 26, color: 'rgba(255,255,255,0.7)' }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>

                  {/* LUT Intensity Slider */}
                  {beauty.lutId && beauty.lutId !== 'none' && (
                    <div
                      style={{
                        padding: '8px 12px',
                        background: 'rgba(255,255,255,0.06)',
                        borderRadius: 'var(--radius-md)',
                        marginBottom: 12,
                      }}
                    >
                      <div className="flex justify-between" style={{ fontSize: 12, marginBottom: 4 }}>
                        <span>🎞️ {t('camera.lutIntensity')}</span>
                        <span style={{ color: '#f59e0b', fontWeight: 700 }}>{beauty.lutIntensity ?? 100}%</span>
                      </div>
                      <input
                        type="range"
                        min="10"
                        max="100"
                        value={beauty.lutIntensity ?? 100}
                        onChange={(e) => setBeauty((prev) => ({ ...prev, lutIntensity: Number(e.target.value) }))}
                        style={{ width: '100%', accentColor: '#f59e0b' }}
                      />
                    </div>
                  )}

                  {/* LUT Presets Carousel */}
                  <div
                    className="flex items-center gap-3"
                    style={{
                      overflowX: 'auto',
                      paddingBottom: 8,
                      scrollbarWidth: 'thin',
                    }}
                  >
                    {lutPresets.map((preset) => {
                      const isSelected = (beauty.lutId ?? 'none') === preset.id;
                      return (
                        <button
                          key={preset.id}
                          onClick={() => {
                            setBeauty((prev) => ({
                              ...prev,
                              lutId: preset.id,
                              lutIntensity: prev.lutIntensity ?? 100,
                            }));
                          }}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 6,
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            flexShrink: 0,
                            padding: '4px',
                          }}
                          title={preset.description}
                        >
                          <div
                            style={{
                              width: 58,
                              height: 58,
                              borderRadius: 16,
                              background: preset.id === 'none'
                                ? 'rgba(255,255,255,0.1)'
                                : `linear-gradient(135deg, ${preset.accentColor}, #0f172a)`,
                              border: isSelected ? `3px solid ${preset.accentColor}` : '2px solid rgba(255,255,255,0.2)',
                              boxShadow: isSelected ? `0 0 16px ${preset.accentColor}99` : 'none',
                              transform: isSelected ? 'scale(1.08)' : 'scale(1)',
                              transition: 'all 0.15s ease',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexDirection: 'column',
                              color: 'white',
                              fontWeight: 800,
                              fontSize: 10,
                              letterSpacing: '0.05em',
                            }}
                          >
                            <span>{preset.badge}</span>
                          </div>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: isSelected ? 700 : 500,
                              color: isSelected ? preset.accentColor : 'rgba(255,255,255,0.8)',
                              whiteSpace: 'nowrap',
                              maxWidth: 72,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {preset.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* FLOATING CAPTURE BUTTON AT BOTTOM INSIDE PREVIEW FRAME */}
              {camera.state === 'active' && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: 16,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 25,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    maxWidth: 'calc(100% - 20px)',
                    padding: '6px 14px',
                    borderRadius: 99,
                    background: 'rgba(15, 23, 42, 0.70)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    boxShadow: '0 12px 32px rgba(0, 0, 0, 0.5)',
                  }}
                >
                  {/* Mode / Count quick switcher */}
                  {!isCapturing && (
                    <div className="flex items-center gap-1">
                      {(['single', 'photobooth'] as CaptureMode[]).map((m) => (
                        <button
                          key={m}
                          onClick={() => setPreviewMode(m)}
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            padding: '6px 12px',
                            borderRadius: 99,
                            border: 'none',
                            cursor: 'pointer',
                            background: previewMode === m ? 'rgba(255,255,255,0.25)' : 'transparent',
                            color: previewMode === m ? '#fff' : 'rgba(255,255,255,0.7)',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          {m === 'single' ? t('camera.singleMode') : `${previewCount}x ${t('camera.stripMode')}`}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Main Shutter Button */}
                  <button
                    id="camera-preview-shutter-btn"
                    onClick={() => {
                      if (isCapturing) {
                        capture.cancelSession();
                      } else {
                        handleCapture(previewMode, previewMode === 'single' ? 1 : previewCount);
                      }
                    }}
                    disabled={camera.state !== 'active'}
                    style={{
                      width: 66,
                      height: 66,
                      borderRadius: '50%',
                      border: '4px solid rgba(255, 255, 255, 0.95)',
                      background: 'transparent',
                      padding: 3,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 0 20px rgba(0,0,0,0.6)',
                      transition: 'transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    }}
                    onMouseDown={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(0.92)'; }}
                    onMouseUp={(e) => { (e.currentTarget as HTMLElement).style.transform = ''; }}
                    title={isCapturing ? t('camera.cancel') : t('camera.capture')}
                    aria-label={isCapturing ? t('camera.cancel') : t('camera.capture')}
                  >
                    <div style={{
                      width: '100%',
                      height: '100%',
                      borderRadius: '50%',
                      background: isCapturing
                        ? 'var(--color-danger)'
                        : 'var(--brand-gradient)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      boxShadow: isCapturing ? '0 0 16px rgba(239,68,68,0.8)' : '0 0 16px rgba(167,139,250,0.6)',
                    }}>
                      {isCapturing ? (
                        <Square size={20} fill="#fff" />
                      ) : (
                        <Camera size={26} />
                      )}
                    </div>
                  </button>

                  {/* Quick count toggle or cancel button */}
                  {isCapturing ? (
                    <button
                      onClick={capture.cancelSession}
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        padding: '6px 14px',
                        borderRadius: 99,
                        border: 'none',
                        background: 'rgba(239, 68, 68, 0.85)',
                        color: '#fff',
                        cursor: 'pointer',
                        transition: 'background 0.2s',
                      }}
                    >
                      {t('camera.cancel')}
                    </button>
                  ) : previewMode === 'photobooth' ? (
                    <div className="flex items-center gap-1">
                      {[3, 4, 6].map((cnt) => (
                        <button
                          key={cnt}
                          onClick={() => setPreviewCount(cnt)}
                          style={{
                            fontSize: 11,
                            fontWeight: previewCount === cnt ? 700 : 500,
                            padding: '4px 8px',
                            borderRadius: 99,
                            border: 'none',
                            background: previewCount === cnt ? 'var(--brand-primary)' : 'rgba(255,255,255,0.1)',
                            color: '#fff',
                            cursor: 'pointer',
                          }}
                        >
                          {cnt}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', paddingRight: 4, fontWeight: 500 }}>
                      {t('camera.singleMode')}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Thumbnail strip */}
        {capture.session && capture.session.photos.length > 0 && (
          <ThumbnailStrip
            photos={capture.session.photos}
            onRetake={capture.retakePhoto}
            onDelete={capture.deletePhoto}
            onReorder={capture.reorderPhotos}
          />
        )}
      </div>
    </div>
  );
}

function StartPrompt({ onStart }: { onStart: () => void }) {
  const { t } = useAppContext();
  return (
    <div className="permission-screen">
      <div className="permission-icon-wrap">
        <Camera size={48} color="var(--brand-primary)" />
      </div>
      <div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, marginBottom: 8 }}>
          {t('camera.readyPrompt')}
        </h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: 340 }}>
          {t('camera.readyDesc')}
        </p>
      </div>
      <button id="start-camera-prompt" className="btn btn-primary btn-xl" onClick={onStart}>
        <Camera size={20} />
        {t('camera.startNow')}
      </button>
    </div>
  );
}

function PermissionError({ message, onRetry, isSecure }: { message: string | null; onRetry: () => void; isSecure: boolean }) {
  const { t } = useAppContext();
  return (
    <div className="permission-screen">
      <div style={{
        width: 80, height: 80,
        background: '#fee2e2',
        borderRadius: 'var(--radius-xl)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <AlertTriangle size={40} color="var(--color-error)" />
      </div>
      <div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20, marginBottom: 8, color: 'var(--color-error)' }}>
          {t('camera.errorTitle')}
        </h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: 380 }}>
          {message ?? 'Could not access the camera.'}
        </p>
        {!isSecure && (
          <div style={{
            marginTop: 12,
            padding: '10px 16px',
            background: '#fef9c3',
            borderRadius: 'var(--radius-md)',
            fontSize: 13,
            color: '#a16207',
          }}>
            ⚠️ This page is not served over HTTPS. Camera access requires HTTPS or localhost.
          </div>
        )}
      </div>
      <button className="btn btn-primary btn-lg" onClick={onRetry}>
        <RefreshCw size={16} />
        {t('camera.retry')}
      </button>
    </div>
  );
}
