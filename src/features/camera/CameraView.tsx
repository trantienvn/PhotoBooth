import { useEffect, useCallback, useState } from 'react';
import {
  Camera, CameraOff, RefreshCw,
  Grid, FlipHorizontal, ChevronDown, ChevronUp, AlertTriangle, Square
} from 'lucide-react';
import { useCamera } from '@/hooks/useCamera';
import { useCaptureSession } from '@/hooks/useCaptureSession';
import { useTimelapse } from '@/hooks/useTimelapse';
import { useAppContext } from '@/app/AppContext';
import type { CaptureMode, CaptureSession } from '@/types';
import { saveSession } from '@/services/storage.service';
import { formatDuration } from '@/services/export.service';
import { CaptureControls } from '@/features/capture/CaptureControls';
import { ThumbnailStrip } from '@/features/capture/ThumbnailStrip';

export function CameraView() {
  const { settings, updateSettings, setCurrentSession, setView, toast, t } = useAppContext();
  const camera = useCamera();
  const capture = useCaptureSession();
  const [showGrid, setShowGrid] = useState(settings.camera.showGrid);
  const [mirror, setMirror] = useState(settings.camera.mirror);
  const [deviceSelectOpen, setDeviceSelectOpen] = useState(false);

  // In-preview quick capture controls
  const [previewMode, setPreviewMode] = useState<CaptureMode>('photobooth');
  const [previewCount, setPreviewCount] = useState<number>(settings.defaultPhotoCount || 4);

  useEffect(() => {
    setMirror(settings.camera.mirror);
  }, [settings.camera.mirror]);

  useEffect(() => {
    setShowGrid(settings.camera.showGrid);
  }, [settings.camera.showGrid]);

  const timelapse = useTimelapse(camera.state === 'active' ? camera.videoRef.current?.srcObject as MediaStream | null : null);

  const handleStartCamera = useCallback(async () => {
    await camera.startCamera(settings.camera);
  }, [camera, settings.camera]);

  const handleStopCamera = useCallback(async () => {
    await camera.stopCamera();
  }, [camera]);

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

    const captureFrame = () => camera.captureFrame(settings.mirrorCapture);
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
  }, [camera, capture, settings, setCurrentSession, timelapse, toast, t, setView]);

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

  const isCapturing = capture.status === 'countdown' || capture.status === 'capturing';

  return (
    <div className="flex h-full w-full" style={{ flex: 1, width: '100%', height: '100%', overflow: 'hidden' }}>
      {/* Sidebar: capture controls */}
      <div className="app-sidebar" style={{ width: 'var(--sidebar-w)', minWidth: 'var(--sidebar-w)', flexShrink: 0 }}>
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

      {/* Main: camera preview */}
      <div className="app-main" style={{ position: 'relative', flex: 1, width: '100%', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Top toolbar */}
        <div className="flex items-center justify-between" style={{
          padding: '12px 24px',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--surface-elevated)',
          width: '100%',
          flexShrink: 0,
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
          </div>

          <div className="flex items-center gap-2">
            {/* Camera device selector */}
            {camera.devices.length > 1 && (
              <div style={{ position: 'relative' }}>
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
                className="btn btn-primary btn-lg"
                onClick={handleStartCamera}
                disabled={camera.state === 'requesting'}
              >
                {camera.state === 'requesting' ? (
                  <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> {t('camera.starting')}</>
                ) : (
                  <><Camera size={16} /> {t('camera.startCamera')}</>
                )}
              </button>
            ) : (
              <button
                id="stop-camera"
                className="btn btn-secondary btn-lg"
                onClick={handleStopCamera}
              >
                <CameraOff size={16} />
                {t('camera.stopCamera')}
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
          padding: 24,
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
                style={{ background: '#000', width: '100%', height: '100%', objectFit: 'cover' }}
              />

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

              {/* FLOATING CAPTURE BUTTON AT BOTTOM INSIDE PREVIEW FRAME */}
              {camera.state === 'active' && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: 22,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 25,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    padding: '8px 18px',
                    borderRadius: 99,
                    background: 'rgba(15, 23, 42, 0.65)',
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
