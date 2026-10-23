import type { ReactNode } from 'react';
import { Camera, Images, Sliders, Download, Settings } from 'lucide-react';
import { useAppContext, type AppView } from '@/app/AppContext';

export function MobileNav() {
  const { currentView, setView, t, currentSession } = useAppContext();

  const photoCount = currentSession?.photos?.length ?? 0;

  const navItems: { id: AppView; labelKey: string; icon: (active: boolean) => ReactNode; badge?: number }[] = [
    {
      id: 'camera',
      labelKey: 'nav.camera',
      icon: (active) => <Camera size={20} strokeWidth={active ? 2.5 : 1.8} />,
    },
    {
      id: 'gallery',
      labelKey: 'nav.gallery',
      icon: (active) => <Images size={20} strokeWidth={active ? 2.5 : 1.8} />,
    },
    {
      id: 'editor',
      labelKey: 'nav.editor',
      icon: (active) => <Sliders size={20} strokeWidth={active ? 2.5 : 1.8} />,
      badge: photoCount > 0 ? photoCount : undefined,
    },
    {
      id: 'export',
      labelKey: 'nav.export',
      icon: (active) => <Download size={20} strokeWidth={active ? 2.5 : 1.8} />,
      badge: photoCount > 0 ? photoCount : undefined,
    },
    {
      id: 'settings',
      labelKey: 'nav.settings',
      icon: (active) => <Settings size={20} strokeWidth={active ? 2.5 : 1.8} />,
    },
  ];

  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
      {navItems.map((item) => {
        const isActive = currentView === item.id;
        return (
          <button
            key={item.id}
            id={`mobile-nav-${item.id}`}
            className={`mobile-nav-item ${isActive ? 'active' : ''}`}
            onClick={() => setView(item.id)}
            aria-current={isActive ? 'page' : undefined}
          >
            <div className="mobile-nav-icon-wrap">
              {item.icon(isActive)}
              {item.badge !== undefined && (
                <span className="mobile-nav-badge">{item.badge}</span>
              )}
            </div>
            <span className="mobile-nav-label">{t(item.labelKey)}</span>
            {isActive && <span className="mobile-nav-indicator" />}
          </button>
        );
      })}
    </nav>
  );
}
