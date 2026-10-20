import React from 'react';
import { Camera, Images, Sliders, Download, Settings, Moon, Sun } from 'lucide-react';
import { useAppContext, type AppView } from '@/app/AppContext';

const navItems: { id: AppView; label: string; icon: React.ReactNode }[] = [
  { id: 'camera', label: 'Camera', icon: <Camera size={18} /> },
  { id: 'gallery', label: 'Gallery', icon: <Images size={18} /> },
  { id: 'editor', label: 'Editor', icon: <Sliders size={18} /> },
  { id: 'export', label: 'Export', icon: <Download size={18} /> },
  { id: 'settings', label: 'Settings', icon: <Settings size={18} /> },
];

export function Header() {
  const { currentView, setView, theme, toggleTheme } = useAppContext();

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
            <span style={{ fontSize: 13 }}>{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Right controls */}
      <div className="flex items-center gap-2">
        <button
          id="toggle-theme"
          className="btn btn-icon btn-ghost"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>
      </div>
    </header>
  );
}
