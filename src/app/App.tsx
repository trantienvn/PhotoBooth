import { AppProvider, useAppContext } from './AppContext';
import { Header } from '@/components/Header';
import { MobileNav } from '@/components/MobileNav';
import { ToastContainer } from '@/components/ToastContainer';
import { CameraView } from '@/features/camera/CameraView';
import { GalleryView } from '@/features/gallery/GalleryView';
import { PhotoEditor } from '@/features/photo-editor/PhotoEditor';
import { ExportView } from '@/features/export/ExportView';
import { SettingsView } from '@/features/settings/SettingsView';

function AppContent() {
  const { currentView, toasts } = useAppContext();

  return (
    <div className="app-root">
      <Header />
      <main className="app-content-body">
        {currentView === 'camera' && <CameraView />}
        {currentView === 'gallery' && (
          <div style={{ flex: 1, overflowY: 'auto', width: '100%', height: '100%' }}>
            <GalleryView />
          </div>
        )}
        {currentView === 'editor' && <PhotoEditor />}
        {currentView === 'export' && <ExportView />}
        {currentView === 'settings' && (
          <div style={{ flex: 1, overflowY: 'auto', width: '100%', height: '100%' }}>
            <SettingsView />
          </div>
        )}
      </main>
      <MobileNav />
      <ToastContainer toasts={toasts} />
    </div>
  );
}

export function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
