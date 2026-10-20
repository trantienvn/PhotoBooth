import { useState, useEffect, type ReactNode } from 'react';
import { Trash2, RotateCcw } from 'lucide-react';
import { useAppContext } from '@/app/AppContext';
import { clearAllData, estimateStorageUsage } from '@/services/storage.service';
import { defaultAppSettings } from '@/types';
import type { Resolution } from '@/types';
import { formatBytes } from '@/services/export.service';

export function SettingsView() {
  const { settings, updateSettings, theme, toggleTheme, toast, language, setLanguage, t } = useAppContext();
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
    if (!confirm(t('settings.clearConfirm'))) return;
    await clearAllData();
    toast(t('settings.clearedSuccess'), 'success');
  };

  const handleResetSettings = () => {
    if (!confirm(t('settings.resetConfirm'))) return;
    updateSettings(defaultAppSettings);
    setLanguage('vi');
    toast(t('settings.resetSuccess'), 'info');
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px', maxWidth: 680, margin: '0 auto', width: '100%' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, marginBottom: 32 }}>
        ⚙️ {t('settings.title')}
      </h1>

      {/* Appearance & Language */}
      <SettingSection title={t('settings.appearanceSection')}>
        <SettingRow label={t('settings.language')}>
          <div className="chip-group">
            <button
              className={`chip ${language === 'vi' ? 'active' : ''}`}
              onClick={() => setLanguage('vi')}
              style={{ fontWeight: language === 'vi' ? 700 : 500 }}
            >
              {t('settings.langVi')}
            </button>
            <button
              className={`chip ${language === 'en' ? 'active' : ''}`}
              onClick={() => setLanguage('en')}
              style={{ fontWeight: language === 'en' ? 700 : 500 }}
            >
              {t('settings.langEn')}
            </button>
          </div>
        </SettingRow>
        <SettingRow label={t('settings.theme')}>
          <div className="chip-group">
            <button
              className={`chip ${theme === 'light' ? 'active' : ''}`}
              onClick={() => { if (theme !== 'light') toggleTheme(); }}
            >
              {t('settings.lightTheme')}
            </button>
            <button
              className={`chip ${theme === 'dark' ? 'active' : ''}`}
              onClick={() => { if (theme !== 'dark') toggleTheme(); }}
            >
              {t('settings.darkTheme')}
            </button>
          </div>
        </SettingRow>
        <SettingRow label={t('export.showWatermark')}>
          <Toggle
            checked={settings.showWatermark}
            onChange={(v) => updateSettings({ showWatermark: v })}
          />
        </SettingRow>
      </SettingSection>

      {/* Camera */}
      <SettingSection title={t('settings.cameraSection')}>
        <SettingRow label={t('settings.defaultRes')}>
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
        <SettingRow label={t('settings.mirrorPreview')}>
          <Toggle
            checked={settings.camera.mirror}
            onChange={(v) => updateSettings({ camera: { ...settings.camera, mirror: v } })}
          />
        </SettingRow>
        <SettingRow label={t('settings.showGrid')}>
          <Toggle
            checked={settings.camera.showGrid}
            onChange={(v) => updateSettings({ camera: { ...settings.camera, showGrid: v } })}
          />
        </SettingRow>
        <SettingRow label={t('settings.mirrorCapture')}>
          <Toggle
            checked={settings.mirrorCapture}
            onChange={(v) => updateSettings({ mirrorCapture: v })}
          />
        </SettingRow>
      </SettingSection>

      {/* Capture */}
      <SettingSection title={t('settings.captureSection')}>
        <SettingRow label={t('settings.countdown')}>
          <div className="chip-group">
            {[0, 3, 5, 10].map((s) => (
              <button
                key={s}
                className={`chip ${settings.countdownSeconds === s ? 'active' : ''}`}
                onClick={() => updateSettings({ countdownSeconds: s })}
              >
                {s === 0 ? t('settings.countdownOff') : `${s}s`}
              </button>
            ))}
          </div>
        </SettingRow>
        <SettingRow label={t('settings.defaultPhotoCount')}>
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
        <SettingRow label={t('settings.delayBetweenShots')}>
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
        <SettingRow label={t('settings.soundEffects')}>
          <Toggle
            checked={settings.soundEnabled}
            onChange={(v) => updateSettings({ soundEnabled: v })}
          />
        </SettingRow>
        <SettingRow label={t('settings.autoTimelapse')}>
          <Toggle
            checked={settings.autoTimelapse}
            onChange={(v) => updateSettings({ autoTimelapse: v })}
          />
        </SettingRow>
      </SettingSection>

      {/* Storage */}
      <SettingSection title={t('settings.storageSection')} padded>
        {storageUsed && (
          <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--text-secondary)' }}>
            {t('settings.storageUsed')}: <strong>{storageUsed}</strong> / {storageQuota}
          </div>
        )}
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
          {t('settings.storageDesc')}
        </div>
        <div className="flex gap-3">
          <button className="btn btn-danger" onClick={handleClearData}>
            <Trash2 size={15} />
            {t('settings.clearAllData')}
          </button>
          <button className="btn btn-secondary" onClick={handleResetSettings}>
            <RotateCcw size={15} />
            {t('settings.resetSettings')}
          </button>
        </div>
      </SettingSection>

      {/* About */}
      <SettingSection title="ℹ️ LumiBooth" padded>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          <p><strong>LumiBooth</strong> v1.0.0 — Modern Photobooth Web Application</p>
          <p>React + TypeScript + Vite | IndexedDB Offline Storage</p>
          <p style={{ marginTop: 8 }}>
            Camera, timelapse video recording, vintage filter presets, sticker drag & drop, and high-res export.
          </p>
        </div>
      </SettingSection>
    </div>
  );
}

function SettingSection({ title, children, padded }: { title: string; children: ReactNode; padded?: boolean }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, marginBottom: 16, color: 'var(--text-primary)' }}>
        {title}
      </h2>
      <div className="card" style={{ padding: padded ? '20px' : '4px 0' }}>
        {children}
      </div>
    </div>
  );
}

function SettingRow({ label, children }: { label: string; children: ReactNode }) {
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
