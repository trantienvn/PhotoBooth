import React, { useState } from 'react';
import { Camera, Video, VideoOff, Pause, Play, Square, Download, Timer, Hash, Repeat } from 'lucide-react';
import type { AppSettings, CaptureMode } from '@/types';
import { formatDuration, formatBytes } from '@/services/export.service';
import type { useTimelapse } from '@/hooks/useTimelapse';

const PHOTO_COUNTS = [3, 4, 5, 6, 8, 9, 12];
const COUNTDOWN_OPTIONS = [0, 3, 5, 10];

type TimelapseState = ReturnType<typeof useTimelapse>;

interface CaptureControlsProps {
  onCapture: (mode: CaptureMode, count: number) => void;
  onSingleCapture: () => void;
  disabled: boolean;
  settings: AppSettings;
  updateSettings: (partial: Partial<AppSettings>) => void;
  captureStatus: string;
  capturedCount: number;
  totalCount: number;
  onCancel: () => void;
  onReset: () => void;
  timelapse: TimelapseState;
  cameraStream: MediaStream | null;
}

export function CaptureControls({
  onCapture,
  onSingleCapture,
  disabled,
  settings,
  updateSettings,
  captureStatus,
  capturedCount,
  totalCount,
  onCancel,
  onReset,
  timelapse,
  cameraStream,
}: CaptureControlsProps) {
  const [mode, setMode] = useState<CaptureMode>('photobooth');
  const [photoCount, setPhotoCount] = useState(settings.defaultPhotoCount);
  const [customCount, setCustomCount] = useState<number | null>(null);
  const isCapturing = captureStatus === 'countdown' || captureStatus === 'capturing' || captureStatus === 'reviewing';

  const effectiveCount = customCount ?? photoCount;

  const handleCapture = () => {
    if (mode === 'single') {
      onSingleCapture();
    } else {
      onCapture(mode, effectiveCount);
    }
  };

  const handleTimelapse = () => {
    if (!cameraStream) return;
    const { state, startRecording, pauseRecording, resumeRecording, stopRecording, downloadVideo } = timelapse;
    if (state.status === 'idle' || state.status === 'stopped') {
      startRecording();
    } else if (state.status === 'recording') {
      stopRecording().then(() => {});
    } else if (state.status === 'paused') {
      resumeRecording();
    }
  };

  return (
    <div className="flex flex-col h-full" style={{ padding: 0 }}>
      <div className="section-header">Mode</div>

      {/* Mode selector */}
      <div style={{ padding: '0 12px 12px' }}>
        <div className="tab-bar">
          {(['single', 'photobooth', 'free'] as CaptureMode[]).map((m) => (
            <button
              key={m}
              className={`tab-item ${mode === m ? 'active' : ''}`}
              onClick={() => setMode(m)}
              style={{ fontSize: 12 }}
            >
              {m === 'single' ? '1x' : m === 'photobooth' ? 'Strip' : 'Free'}
            </button>
          ))}
        </div>
      </div>

      {/* Photo count (only for photobooth mode) */}
      {mode === 'photobooth' && (
        <>
          <div className="section-header">Photos</div>
          <div style={{ padding: '0 12px 12px' }}>
            <div className="chip-group">
              {PHOTO_COUNTS.map((n) => (
                <button
                  key={n}
                  className={`chip ${!customCount && photoCount === n ? 'active' : ''}`}
                  onClick={() => { setPhotoCount(n); setCustomCount(null); }}
                  disabled={isCapturing}
                >
                  {n}
                </button>
              ))}
              <button
                className={`chip ${customCount !== null ? 'active' : ''}`}
                onClick={() => {
                  const val = prompt('Enter number of photos (1-20):');
                  if (val) {
                    const n = parseInt(val);
                    if (n >= 1 && n <= 20) setCustomCount(n);
                  }
                }}
                disabled={isCapturing}
              >
                {customCount ? `${customCount}✓` : 'Custom'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Countdown */}
      <div className="section-header">Countdown</div>
      <div style={{ padding: '0 12px 12px' }}>
        <div className="chip-group">
          {COUNTDOWN_OPTIONS.map((s) => (
            <button
              key={s}
              className={`chip ${settings.countdownSeconds === s ? 'active' : ''}`}
              onClick={() => updateSettings({ countdownSeconds: s })}
            >
              {s === 0 ? 'Off' : `${s}s`}
            </button>
          ))}
        </div>
      </div>

      {/* Delay between shots */}
      {mode === 'photobooth' && (
        <>
          <div className="section-header">Delay Between Shots</div>
          <div style={{ padding: '0 12px 12px' }}>
            <div className="chip-group">
              {[500, 1000, 1500, 2000, 3000].map((ms) => (
                <button
                  key={ms}
                  className={`chip ${settings.delayBetweenShots === ms ? 'active' : ''}`}
                  onClick={() => updateSettings({ delayBetweenShots: ms })}
                >
                  {ms / 1000}s
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Capture progress */}
      {isCapturing && totalCount > 1 && (
        <div style={{ padding: '0 12px 12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
            <span>Progress</span>
            <span style={{ fontWeight: 600, color: 'var(--brand-primary)' }}>{capturedCount} / {totalCount}</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${(capturedCount / totalCount) * 100}%` }} />
          </div>
        </div>
      )}

      {/* Main capture button */}
      <div style={{ padding: '12px' }}>
        {!isCapturing ? (
          <button
            id="capture-btn"
            className="btn btn-primary btn-xl w-full"
            onClick={handleCapture}
            disabled={disabled}
            style={{ height: 56 }}
          >
            <Camera size={22} />
            {mode === 'single' ? 'Take Photo' : `Capture ${effectiveCount} Photos`}
          </button>
        ) : (
          <button
            id="cancel-capture-btn"
            className="btn btn-danger w-full btn-lg"
            onClick={onCancel}
          >
            <Square size={18} />
            Cancel
          </button>
        )}
      </div>

      {/* Reset */}
      {!isCapturing && capturedCount > 0 && (
        <div style={{ padding: '0 12px' }}>
          <button className="btn btn-ghost w-full" style={{ fontSize: 13 }} onClick={onReset}>
            <Repeat size={14} />
            New Session
          </button>
        </div>
      )}

      {/* Timelapse section */}
      <div style={{ marginTop: 'auto' }}>
        <div className="section-header">Timelapse Recording</div>
        <div style={{ padding: '0 12px 12px' }}>
          {timelapse.state.status === 'idle' || timelapse.state.status === 'stopped' ? (
            <button
              id="start-timelapse-btn"
              className="btn btn-secondary w-full"
              onClick={handleTimelapse}
              disabled={!cameraStream}
            >
              <Video size={16} />
              {timelapse.state.status === 'stopped' ? 'Restart Timelapse' : 'Record Timelapse'}
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: '#fee2e2', borderRadius: 'var(--radius-md)', fontSize: 13 }}>
                <div className="recording-dot" />
                <span style={{ fontWeight: 600, color: 'var(--color-error)' }}>
                  {formatDuration(timelapse.state.duration)}
                </span>
                <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>
                  ~{formatBytes(timelapse.state.estimatedSize)}
                </span>
              </div>
              <div className="flex gap-2">
                {timelapse.state.status === 'recording' ? (
                  <button className="btn btn-secondary flex-1" style={{ fontSize: 12 }} onClick={() => timelapse.pauseRecording()}>
                    <Pause size={14} /> Pause
                  </button>
                ) : (
                  <button className="btn btn-secondary flex-1" style={{ fontSize: 12 }} onClick={() => timelapse.resumeRecording()}>
                    <Play size={14} /> Resume
                  </button>
                )}
                <button
                  id="stop-timelapse-btn"
                  className="btn btn-danger flex-1"
                  style={{ fontSize: 12 }}
                  onClick={() => timelapse.stopRecording()}
                >
                  <Square size={14} /> Stop
                </button>
              </div>
            </div>
          )}

          {timelapse.state.blobUrl && (
            <div style={{ marginTop: 8 }}>
              <video
                src={timelapse.state.blobUrl}
                controls
                style={{ width: '100%', borderRadius: 'var(--radius-md)', maxHeight: 150 }}
              />
              <button
                className="btn btn-primary w-full btn-lg"
                style={{ marginTop: 6 }}
                onClick={timelapse.downloadVideo}
              >
                <Download size={16} />
                Download Video
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Settings quick options */}
      <div style={{ padding: '12px', borderTop: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Sound</span>
          <button
            className={`btn btn-icon ${settings.soundEnabled ? 'btn-primary' : 'btn-secondary'}`}
            style={{ width: 32, height: 32, fontSize: 11 }}
            onClick={() => updateSettings({ soundEnabled: !settings.soundEnabled })}
            aria-label="Toggle sound"
          >
            {settings.soundEnabled ? '🔊' : '🔇'}
          </button>
        </div>
        <div className="flex items-center justify-between">
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Mirror capture</span>
          <button
            className={`btn btn-icon ${settings.mirrorCapture ? 'btn-primary' : 'btn-secondary'}`}
            style={{ width: 32, height: 32, fontSize: 11 }}
            onClick={() => updateSettings({ mirrorCapture: !settings.mirrorCapture })}
            aria-label="Toggle mirror capture"
          >
            ↔
          </button>
        </div>
      </div>
    </div>
  );
}
