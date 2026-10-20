import { useState, useEffect } from 'react';
import { Images, Trash2, RefreshCw, ExternalLink, Video } from 'lucide-react';
import { useAppContext } from '@/app/AppContext';
import { getAllSessions, deleteSession } from '@/services/storage.service';
import type { CaptureSession } from '@/types';

export function GalleryView() {
  const { setCurrentSession, setView, toast, t } = useAppContext();
  const [sessions, setSessions] = useState<CaptureSession[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSessions = async () => {
    setLoading(true);
    const all = await getAllSessions();
    setSessions(all);
    setLoading(false);
  };

  useEffect(() => { loadSessions(); }, []);

  const handleOpenSession = (session: CaptureSession) => {
    setCurrentSession(session);
    setView('editor');
  };

  const handleDeleteSession = async (id: string) => {
    if (!confirm(t('gallery.deleteConfirm'))) return;
    await deleteSession(id);
    setSessions((prev) => prev.filter((s) => s.id !== id));
    toast('Session deleted.', 'info');
  };

  const emptySessions = sessions.filter((s) => s.photos.length === 0);

  const handleCleanEmptySessions = async () => {
    for (const s of emptySessions) {
      await deleteSession(s.id);
    }
    setSessions((prev) => prev.filter((s) => s.photos.length > 0));
    toast(`Cleaned up ${emptySessions.length} empty session(s).`, 'success');
  };

  const handleDownloadVideo = (session: CaptureSession) => {
    if (!session.timelapseUrl) return;
    const a = document.createElement('a');
    a.href = session.timelapseUrl;
    a.download = `lumibooth_timelapse_${session.id.slice(0, 8)}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast('Timelapse video downloaded!', 'success');
  };

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center" style={{ flex: 1, width: '100%', height: '100%' }}>
        <div className="spinner" style={{ width: 40, height: 40 }} />
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center" style={{ flex: 1, width: '100%', height: '100%' }}>
        <div className="empty-state">
          <div className="empty-icon"><Images size={32} /></div>
          <h3 style={{ fontWeight: 600 }}>{t('gallery.noSavedSessions')}</h3>
          <p>{t('gallery.takePhotosHint')}</p>
          <button className="btn btn-primary" onClick={() => setView('camera')}>{t('gallery.goToCamera')}</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 24, width: '100%' }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28 }}>
            🖼️ {t('gallery.title')}
          </h1>
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 2 }}>
            {t('gallery.savedCount', { count: sessions.length })}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {emptySessions.length > 0 && (
            <button className="btn btn-secondary" onClick={handleCleanEmptySessions} style={{ color: 'var(--color-danger)' }}>
              <Trash2 size={14} /> {t('gallery.clearEmpty', { count: emptySessions.length })}
            </button>
          )}
          <button className="btn btn-secondary" onClick={loadSessions}>
            <RefreshCw size={15} /> {t('gallery.refresh')}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
        {sessions.map((session) => (
          <SessionCard
            key={session.id}
            session={session}
            onOpen={() => handleOpenSession(session)}
            onDelete={() => handleDeleteSession(session.id)}
            onDownloadVideo={() => handleDownloadVideo(session)}
            t={t}
          />
        ))}
      </div>
    </div>
  );
}

function SessionCard({
  session,
  onOpen,
  onDelete,
  onDownloadVideo,
  t,
}: {
  session: CaptureSession;
  onOpen: () => void;
  onDelete: () => void;
  onDownloadVideo: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const date = new Date(session.createdAt).toLocaleString();
  const thumbPhotos = session.photos.slice(0, 4);

  return (
    <div className="card" style={{ overflow: 'hidden', transition: 'box-shadow 0.2s, transform 0.2s' }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
        (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-lg)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.transform = '';
        (e.currentTarget as HTMLElement).style.boxShadow = '';
      }}
    >
      {/* Photo grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: thumbPhotos.length === 1 ? '1fr' : 'repeat(2, 1fr)',
        gap: 2,
        background: '#09090b',
        height: 160,
      }}>
        {thumbPhotos.map((photo) => (
          <img
            key={photo.id}
            src={photo.editedDataUrl ?? photo.dataUrl}
            alt={`Photo ${photo.index + 1}`}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ))}
        {thumbPhotos.length === 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#71717a', fontSize: 13 }}>
            {t('gallery.noPhotosTaken')}
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: '12px 16px' }}>
        <div className="flex items-center justify-between">
          <div style={{ fontSize: 13, fontWeight: 600 }}>
            {t('gallery.photoCount', { count: session.photos.length })}
            {' · '}
            <span style={{ color: 'var(--text-tertiary)', textTransform: 'capitalize' }}>{session.mode}</span>
          </div>
          {session.timelapseUrl && (
            <span className="badge badge-active" style={{ fontSize: 10, padding: '2px 6px' }}>
              🎬 {t('gallery.video')}
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{date}</div>
      </div>

      {/* Actions */}
      <div className="flex" style={{ borderTop: '1px solid var(--border-subtle)', padding: 8, gap: 6 }}>
        {session.photos.length > 0 ? (
          <button className="btn btn-primary flex-1" style={{ fontSize: 13 }} onClick={onOpen}>
            <ExternalLink size={14} /> {t('gallery.open')}
          </button>
        ) : (
          <div style={{ flex: 1, fontSize: 12, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center' }}>
            {t('gallery.emptySession')}
          </div>
        )}

        {session.timelapseUrl && (
          <button className="btn btn-secondary" style={{ fontSize: 12, padding: '4px 10px' }} onClick={onDownloadVideo} title="Download timelapse video">
            <Video size={13} /> {t('gallery.video')}
          </button>
        )}

        <button className="btn btn-danger btn-icon" onClick={onDelete} aria-label={t('gallery.delete')} title={t('gallery.delete')}>
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
