import { AppProvider, useAppContext } from './AppContext';
import { Header } from '@/components/Header';
import { ToastContainer } from '@/components/ToastContainer';
import { CameraView } from '@/features/camera/CameraView';
import { GalleryView } from '@/features/gallery/GalleryView';
import { PhotoEditor } from '@/features/photo-editor/PhotoEditor';
import { ExportView } from '@/features/export/ExportView';
import { SettingsView } from '@/features/settings/SettingsView';

function AppContent() {
  const { currentView, toasts } = useAppContext();

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100dvh',
      overflow: 'hidden',
      background: 'var(--surface-bg)',
    }}>
      <Header />
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', width: '100%', height: '100%', minHeight: 0 }}>
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
      </div>
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
