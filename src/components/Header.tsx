import type { ReactNode } from 'react';
import { Camera, Images, Sliders, Download, Settings, Moon, Sun, Globe } from 'lucide-react';
import { useAppContext, type AppView } from '@/app/AppContext';

export function Header() {
  const { currentView, setView, theme, toggleTheme, language, setLanguage, t } = useAppContext();

  const navItems: { id: AppView; labelKey: string; icon: ReactNode }[] = [
    { id: 'camera', labelKey: 'nav.camera', icon: <Camera size={18} /> },
    { id: 'gallery', labelKey: 'nav.gallery', icon: <Images size={18} /> },
    { id: 'editor', labelKey: 'nav.editor', icon: <Sliders size={18} /> },
    { id: 'export', labelKey: 'nav.export', icon: <Download size={18} /> },
    { id: 'settings', labelKey: 'nav.settings', icon: <Settings size={18} /> },
  ];

  return (
    <header className="app-header">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div style={{
          width: 36,
          height: 36,
          background: 'var(--brand-gradient)',
          borderRadius: 'var(--radius-lg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: 'var(--shadow-brand)',
        }}>
          <Camera size={20} color="white" />
        </div>
        <div>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: 18,
            lineHeight: 1,
            background: 'var(--brand-gradient)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            LumiBooth
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 1 }}>
            Web Photobooth
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex items-center gap-1" role="navigation" aria-label="Main navigation">
        {navItems.map((item) => (
          <button
            key={item.id}
            id={`nav-${item.id}`}
            className={`btn btn-ghost ${currentView === item.id ? 'active' : ''}`}
            onClick={() => setView(item.id)}
            aria-current={currentView === item.id ? 'page' : undefined}
            style={{
              color: currentView === item.id ? 'var(--brand-primary)' : 'var(--text-secondary)',
              background: currentView === item.id ? 'rgba(167,139,250,0.1)' : undefined,
              fontWeight: currentView === item.id ? 600 : 400,
            }}
          >
            {item.icon}
            <span style={{ fontSize: 13 }}>{t(item.labelKey)}</span>
          </button>
        ))}
      </nav>

      {/* Right controls */}
      <div className="flex items-center gap-2">
        {/* Language switch button */}
        <button
          id="toggle-language"
          className="btn btn-ghost"
          style={{ fontSize: 12, padding: '4px 10px', gap: 6, fontWeight: 600 }}
          onClick={() => setLanguage(language === 'vi' ? 'en' : 'vi')}
          title="Đổi ngôn ngữ / Switch language"
          aria-label="Switch language"
        >
          <Globe size={15} />
          {language === 'vi' ? '🇻🇳 VI' : '🇬🇧 EN'}
        </button>

        {/* Theme toggle */}
        <button
          id="toggle-theme"
          className="btn btn-icon btn-ghost"
          onClick={toggleTheme}
          aria-label={t('nav.switchTheme')}
          title={t('nav.switchTheme')}
        >
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>
      </div>
    </header>
  );
}
