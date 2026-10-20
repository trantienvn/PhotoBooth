import React from 'react';
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
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        {currentView === 'camera' && <CameraView />}
        {currentView === 'gallery' && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <GalleryView />
          </div>
        )}
        {currentView === 'editor' && <PhotoEditor />}
        {currentView === 'export' && <ExportView />}
        {currentView === 'settings' && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
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
