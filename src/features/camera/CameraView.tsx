import React, { useEffect, useRef, useCallback, useState } from 'react';
import {
  Camera, CameraOff, RefreshCw, Video, VideoOff, Pause, Play,
  Grid, FlipHorizontal, Zap, ZapOff, ChevronDown, ChevronUp, AlertTriangle
} from 'lucide-react';
import { useCamera } from '@/hooks/useCamera';
import { useCaptureSession } from '@/hooks/useCaptureSession';
import { useTimelapse } from '@/hooks/useTimelapse';
import { useAppContext } from '@/app/AppContext';
import type { CaptureMode } from '@/types';
import { formatDuration, formatBytes } from '@/services/export.service';
import { CaptureControls } from '@/features/capture/CaptureControls';
import { ThumbnailStrip } from '@/features/capture/ThumbnailStrip';

export function CameraView() {
  const { settings, updateSettings, setCurrentSession, setView, toast } = useAppContext();
  const camera = useCamera();
  const capture = useCaptureSession();
  const [cameraStarted, setCameraStarted] = useState(false);
  const [showGrid, setShowGrid] = useState(settings.camera.showGrid);
  const [mirror, setMirror] = useState(settings.camera.mirror);
  const [deviceSelectOpen, setDeviceSelectOpen] = useState(false);

  const timelapse = useTimelapse(camera.state === 'active' ? camera.videoRef.current?.srcObject as MediaStream | null : null);

  // When session is done, navigate to editor
  useEffect(() => {
    if (capture.session && capture.status === 'reviewing' && capture.session.capturedCount >= capture.session.totalCount) {
      setCurrentSession(capture.session);
      toast('Photos captured! Choose a template to continue.', 'success');
      setView('editor');
    }
  }, [capture.status, capture.session, setCurrentSession, setView, toast]);

  const handleStartCamera = useCallback(async () => {
    await camera.startCamera(settings.camera);
    setCameraStarted(true);
  }, [camera, settings.camera]);

  const handleStopCamera = useCallback(async () => {
    await camera.stopCamera();
    setCameraStarted(false);
  }, [camera]);

  const handleCapture = useCallback(async (mode: CaptureMode, count: number) => {
    if (camera.state !== 'active') {
      toast('Please start camera first', 'error');
      return;
    }
    const session = capture.startSession(mode, count);
    setCurrentSession(session);

    const captureFrame = () => camera.captureFrame(settings.mirrorCapture);
    await capture.beginCapture(captureFrame, {
      countdownSeconds: settings.countdownSeconds,
      delayBetweenShots: settings.delayBetweenShots,
      soundEnabled: settings.soundEnabled,
      mirrorCapture: settings.mirrorCapture,
      autoAdvance: true,
    });
  }, [camera, capture, settings, setCurrentSession, toast]);

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
    <div className="flex h-full w-full" style={{ flex: 1, width: '100%', overflow: 'hidden' }}>
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
              {camera.state === 'active' ? 'Live' : camera.state === 'requesting' ? 'Starting…' : 'Camera Off'}
            </div>

            {/* Timelapse status */}
            {timelapse.state.status === 'recording' && (
              <div className="badge badge-recording">
                <div className="recording-dot" />
                REC {formatDuration(timelapse.state.duration)}
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
                  Switch Camera
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
              title="Toggle mirror"
              aria-label="Toggle mirror"
            >
              <FlipHorizontal size={16} />
            </button>

            {/* Grid toggle */}
            <button
              id="toggle-grid"
              className={`btn btn-icon ${showGrid ? 'btn-primary' : 'btn-secondary'}`}
              onClick={toggleGrid}
              title="Toggle grid"
              aria-label="Toggle composition grid"
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
                  <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Starting…</>
                ) : (
                  <><Camera size={16} /> Start Camera</>
                )}
              </button>
            ) : (
              <button
                id="stop-camera"
                className="btn btn-secondary btn-lg"
                onClick={handleStopCamera}
              >
                <CameraOff size={16} />
                Stop
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
                width: '100%',
                maxWidth: 880,
                maxHeight: 'calc(100vh - var(--header-h) - 180px)',
                aspectRatio: '4/3',
                boxShadow: 'var(--shadow-xl)',
                margin: 'auto',
              }}
            >
              <video
                ref={camera.videoRef}
                id="camera-preview"
                autoPlay
                playsInline
                muted
                className={`camera-video ${mirror ? 'mirror' : ''}`}
                style={{ background: '#000' }}
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
                  bottom: 12,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'rgba(0,0,0,0.6)',
                  color: 'white',
                  padding: '4px 14px',
                  borderRadius: 99,
                  fontSize: 13,
                  fontWeight: 600,
                }}>
                  {capture.session.capturedCount + 1} / {capture.session.totalCount}
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
  return (
    <div className="permission-screen">
      <div className="permission-icon-wrap">
        <Camera size={48} color="var(--brand-primary)" />
      </div>
      <div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, marginBottom: 8 }}>
          Ready to capture?
        </h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: 340 }}>
          Click below to start your webcam and take beautiful photos with LumiBooth.
        </p>
      </div>
      <button id="start-camera-prompt" className="btn btn-primary btn-xl" onClick={onStart}>
        <Camera size={20} />
        Start Camera
      </button>
      <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
        Your camera is only activated when you click Start. All processing is local — no uploads.
      </p>
    </div>
  );
}

function PermissionError({ message, onRetry, isSecure }: { message: string | null; onRetry: () => void; isSecure: boolean }) {
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
          Camera Unavailable
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
        Try Again
      </button>
    </div>
  );
}
