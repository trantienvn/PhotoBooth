import { useState, type DragEvent } from 'react';
import { Trash2, RefreshCw } from 'lucide-react';
import type { Photo } from '@/types';

interface ThumbnailStripProps {
  photos: Photo[];
  onRetake: (id: string) => void;
  onDelete: (id: string) => void;
  onReorder: (from: number, to: number) => void;
}

export function ThumbnailStrip({ photos, onRetake, onDelete, onReorder }: ThumbnailStripProps) {
  const [dragging, setDragging] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [activePhotoId, setActivePhotoId] = useState<string | null>(null);

  const handleDragStart = (index: number) => {
    setDragging(index);
  };

  const handleDragOver = (e: DragEvent, index: number) => {
    e.preventDefault();
    setDragOver(index);
  };

  const handleDrop = (index: number) => {
    if (dragging !== null && dragging !== index) {
      onReorder(dragging, index);
    }
    setDragging(null);
    setDragOver(null);
  };

  return (
    <div className="thumbnail-strip touch-scroll-x" role="list" aria-label="Captured photos">
      {photos.map((photo, i) => (
        <div
          key={photo.id}
          role="listitem"
          className={`thumbnail-item ${dragOver === i || activePhotoId === photo.id ? 'selected' : ''}`}
          draggable
          onClick={() => setActivePhotoId((prev) => (prev === photo.id ? null : photo.id))}
          onDragStart={() => handleDragStart(i)}
          onDragOver={(e) => handleDragOver(e, i)}
          onDrop={() => handleDrop(i)}
          onDragEnd={() => { setDragging(null); setDragOver(null); }}
          style={{ opacity: dragging === i ? 0.4 : 1 }}
        >
          <img src={photo.editedDataUrl ?? photo.dataUrl} alt={`Photo ${i + 1}`} loading="lazy" />
          <div className="thumbnail-badge">{i + 1}</div>

          {/* Actions on hover or tap */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(0,0,0,0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            opacity: activePhotoId === photo.id ? 1 : 0,
            transition: 'opacity 0.15s',
          }} className="thumbnail-actions">
            <button
              className="btn btn-icon"
              style={{ background: 'rgba(255,255,255,0.95)', width: 32, height: 32 }}
              onClick={(e) => { e.stopPropagation(); onRetake(photo.id); }}
              title="Retake"
              aria-label={`Retake photo ${i + 1}`}
            >
              <RefreshCw size={14} />
            </button>
            <button
              className="btn btn-icon"
              style={{ background: 'rgba(239,68,68,0.95)', color: 'white', width: 32, height: 32 }}
              onClick={(e) => { e.stopPropagation(); onDelete(photo.id); }}
              title="Delete"
              aria-label={`Delete photo ${i + 1}`}
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      ))}

      {/* CSS for hover actions */}
      <style>{`.thumbnail-item:hover .thumbnail-actions { opacity: 1 !important; }`}</style>
    </div>
  );
}
