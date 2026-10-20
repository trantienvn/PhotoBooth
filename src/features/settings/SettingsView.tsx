import React, { useState, useEffect } from 'react';
import { Settings, Trash2, Volume2, VolumeX, Moon, Sun, RotateCcw } from 'lucide-react';
import { useAppContext } from '@/app/AppContext';
import { clearAllData, estimateStorageUsage, loadSettings, saveSettings } from '@/services/storage.service';
import { defaultAppSettings } from '@/types';
import type { Resolution } from '@/types';
import { formatBytes } from '@/services/export.service';

export function SettingsView() {
  const { settings, updateSettings, theme, toggleTheme, toast } = useAppContext();
  const [storageUsed, setStorageUsed] = useState<string | null>(null);
  const [storageQuota, setStorageQuota] = useState<string | null>(null);

  useEffect(() => {
    estimateStorageUsage().then((est) => {
      if (est) {
        setStorageUsed(formatBytes(est.used));
        setStorageQuota(formatBytes(est.quota));
      }
    });
  }, []);

  const handleClearData = async () => {
    if (!confirm('Delete all saved sessions and photos? This cannot be undone.')) return;
    await clearAllData();
    toast('All local data cleared.', 'success');
  };

  const handleResetSettings = () => {
    updateSettings(defaultAppSettings);
    toast('Settings reset to defaults.', 'info');
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px', maxWidth: 680, margin: '0 auto', width: '100%' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, marginBottom: 32 }}>
        ⚙️ Settings
      </h1>

      {/* Camera */}
      <SettingSection title="📷 Camera">
        <SettingRow label="Default resolution">
          <div className="chip-group">
            {(['480p', '720p', '1080p', 'best'] as Resolution[]).map((r) => (
              <button
                key={r}
                className={`chip ${settings.camera.resolution === r ? 'active' : ''}`}
                onClick={() => updateSettings({ camera: { ...settings.camera, resolution: r } })}
              >
                {r}
              </button>
            ))}
          </div>
        </SettingRow>
        <SettingRow label="Mirror preview">
          <Toggle
            checked={settings.camera.mirror}
            onChange={(v) => updateSettings({ camera: { ...settings.camera, mirror: v } })}
          />
        </SettingRow>
        <SettingRow label="Show grid overlay">
          <Toggle
            checked={settings.camera.showGrid}
            onChange={(v) => updateSettings({ camera: { ...settings.camera, showGrid: v } })}
          />
        </SettingRow>
        <SettingRow label="Mirror capture (saved photo)">
          <Toggle
            checked={settings.mirrorCapture}
            onChange={(v) => updateSettings({ mirrorCapture: v })}
          />
        </SettingRow>
      </SettingSection>

      {/* Capture */}
      <SettingSection title="📸 Capture">
        <SettingRow label="Countdown duration">
          <div className="chip-group">
            {[0, 3, 5, 10].map((s) => (
              <button
                key={s}
                className={`chip ${settings.countdownSeconds === s ? 'active' : ''}`}
                onClick={() => updateSettings({ countdownSeconds: s })}
              >
                {s === 0 ? 'Off' : `${s}s`}
              </button>
            ))}
          </div>
        </SettingRow>
        <SettingRow label="Default photo count">
          <div className="chip-group">
            {[3, 4, 5, 6, 8, 9, 12].map((n) => (
              <button
                key={n}
                className={`chip ${settings.defaultPhotoCount === n ? 'active' : ''}`}
                onClick={() => updateSettings({ defaultPhotoCount: n })}
              >
                {n}
              </button>
            ))}
          </div>
        </SettingRow>
        <SettingRow label="Delay between shots">
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
        </SettingRow>
        <SettingRow label="Sound effects">
          <Toggle
            checked={settings.soundEnabled}
            onChange={(v) => updateSettings({ soundEnabled: v })}
          />
        </SettingRow>
      </SettingSection>

      {/* Appearance */}
      <SettingSection title="🎨 Appearance">
        <SettingRow label="Theme">
          <div className="chip-group">
            <button
              className={`chip ${theme === 'light' ? 'active' : ''}`}
              onClick={() => { if (theme !== 'light') toggleTheme(); }}
            >
              ☀️ Light
            </button>
            <button
              className={`chip ${theme === 'dark' ? 'active' : ''}`}
              onClick={() => { if (theme !== 'dark') toggleTheme(); }}
            >
              🌙 Dark
            </button>
          </div>
        </SettingRow>
        <SettingRow label="Show watermark on exports">
          <Toggle
            checked={settings.showWatermark}
            onChange={(v) => updateSettings({ showWatermark: v })}
          />
        </SettingRow>
      </SettingSection>

      {/* Storage */}
      <SettingSection title="💾 Storage & Privacy">
        {storageUsed && (
          <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--text-secondary)' }}>
            Storage used: <strong>{storageUsed}</strong> of {storageQuota}
          </div>
        )}
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
          All your photos and videos are stored locally in your browser's IndexedDB. They are never uploaded to any server.
          LumiBooth does not collect any personal data.
        </div>
        <div className="flex gap-3">
          <button className="btn btn-danger" onClick={handleClearData}>
            <Trash2 size={15} />
            Clear All Data
          </button>
          <button className="btn btn-secondary" onClick={handleResetSettings}>
            <RotateCcw size={15} />
            Reset Settings
          </button>
        </div>
      </SettingSection>

      {/* About */}
      <SettingSection title="ℹ️ About">
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          <p><strong>LumiBooth</strong> v1.0.0</p>
          <p>A browser-based photobooth application built with React + TypeScript + Vite.</p>
          <p style={{ marginTop: 8 }}>
            Supported browsers: Chrome, Edge (full), Firefox (partial), Safari (partial).
          </p>
          <p style={{ marginTop: 8 }}>
            Note: Camera access requires HTTPS or localhost. MediaRecorder for video recording uses WebM format in most browsers.
          </p>
        </div>
      </SettingSection>
    </div>
  );
}

function SettingSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, marginBottom: 16, color: 'var(--text-primary)' }}>
        {title}
      </h2>
      <div className="card" style={{ padding: '4px 0' }}>
        {children}
      </div>
    </div>
  );
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
      padding: '14px 20px',
      borderBottom: '1px solid var(--border-subtle)',
      flexWrap: 'wrap',
    }}>
      <span style={{ fontSize: 14, color: 'var(--text-secondary)', flexShrink: 0 }}>{label}</span>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      style={{
        width: 44,
        height: 24,
        borderRadius: 99,
        background: checked ? 'var(--brand-primary)' : 'var(--border-strong)',
        position: 'relative',
        transition: 'background 0.2s',
        border: 'none',
        cursor: 'pointer',
        flexShrink: 0,
      }}
    >
      <div style={{
        position: 'absolute',
        top: 2,
        left: checked ? 22 : 2,
        width: 20,
        height: 20,
        borderRadius: '50%',
        background: 'white',
        boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
        transition: 'left 0.2s',
      }} />
    </button>
  );
}
