import { useState, useEffect, useRef, useCallback } from 'react';
import { Sliders, RotateCcw, FlipHorizontal, ArrowLeft, ArrowRight, Eye, EyeOff, Film, Download, Palette } from 'lucide-react';
import { useAppContext } from '@/app/AppContext';
import type { Photo, PhotoEditState, FilterSettings, FilterPresetName, LutPresetId } from '@/types';
import { defaultPhotoEditState, defaultFilterSettings } from '@/types';
import { filterPresets } from '@/services/image-processing.service';
import { applyFiltersToCanvas } from '@/services/image-processing.service';
import { lutPresets, generateLutStripAsset } from '@/services/lut.service';

interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}

function SliderRow({ label, value, min, max, onChange }: SliderRowProps) {
  return (
    <div className="slider-group">
      <div className="slider-label-row">
        <span className="slider-label">{label}</span>
        <span className="slider-value">{value > 0 ? `+${value}` : value}</span>
      </div>
      <input
        type="range"
        className="range-input"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

export function PhotoEditor() {
  const { currentSession, editStates, setEditState, setView, toast, t } = useAppContext();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [applyToAll, setApplyToAll] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [activeTab, setActiveTab] = useState<'lut' | 'presets' | 'adjust'>('lut');

  const photos = currentSession?.photos ?? [];

  useEffect(() => {
    if (photos.length > 0 && !selectedId) {
      setSelectedId(photos[0].id);
    }
  }, [photos, selectedId]);

  const selectedPhoto = photos.find((p) => p.id === selectedId);
  const currentEdit = (selectedId ? editStates.get(selectedId) : null) ?? defaultPhotoEditState;

  const updateEdit = useCallback((updater: (prev: PhotoEditState) => PhotoEditState) => {
    if (!selectedId) return;
    const prev = editStates.get(selectedId) ?? defaultPhotoEditState;
    const next = updater(prev);
    setEditState(selectedId, next);

    if (applyToAll) {
      for (const photo of photos) {
        const prevP = editStates.get(photo.id) ?? defaultPhotoEditState;
        setEditState(photo.id, updater(prevP));
      }
    }
    setPreviewKey((k) => k + 1);
  }, [selectedId, editStates, setEditState, photos, applyToAll]);

  const updateFilter = useCallback((key: keyof FilterSettings, value: number) => {
    updateEdit((prev) => ({
      ...prev,
      filter: { ...prev.filter, [key]: value },
      presetId: undefined,
    }));
  }, [updateEdit]);

  const applyPreset = useCallback((presetId: FilterPresetName) => {
    const preset = filterPresets.find((p) => p.id === presetId);
    if (!preset) return;
    updateEdit((prev) => ({
      ...prev,
      filter: { ...preset.settings },
      presetId,
    }));
  }, [updateEdit]);

  const applyLut = useCallback((lutId: LutPresetId) => {
    updateEdit((prev) => ({
      ...prev,
      lutId,
      lutIntensity: prev.lutIntensity ?? 100,
    }));
  }, [updateEdit]);

  const updateLutIntensity = useCallback((intensity: number) => {
    updateEdit((prev) => ({
      ...prev,
      lutIntensity: intensity,
    }));
  }, [updateEdit]);

  const resetEdit = useCallback(() => {
    if (!selectedId) return;
    setEditState(selectedId, defaultPhotoEditState);
    setPreviewKey((k) => k + 1);
  }, [selectedId, setEditState]);

  const rotatePhoto = useCallback(() => {
    updateEdit((prev) => ({
      ...prev,
      crop: { ...prev.crop, rotation: ((prev.crop.rotation ?? 0) + 90) % 360 },
    }));
  }, [updateEdit]);

  const flipPhoto = useCallback(() => {
    updateEdit((prev) => ({
      ...prev,
      crop: { ...prev.crop, flipH: !prev.crop.flipH },
    }));
  }, [updateEdit]);

  const goNext = () => {
    const idx = photos.findIndex((p) => p.id === selectedId);
    if (idx < photos.length - 1) setSelectedId(photos[idx + 1].id);
  };

  const goPrev = () => {
    const idx = photos.findIndex((p) => p.id === selectedId);
    if (idx > 0) setSelectedId(photos[idx - 1].id);
  };

  if (!currentSession || photos.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center" style={{ flex: 1, width: '100%', height: '100%' }}>
        <div className="empty-state">
          <div className="empty-icon"><Sliders size={32} /></div>
          <h3 style={{ fontWeight: 600 }}>{t('editor.noPhotos')}</h3>
          <p>{t('editor.noPhotosDesc')}</p>
          <button className="btn btn-primary" onClick={() => setView('camera')}>
            {t('editor.goToCamera')}
          </button>
        </div>
      </div>
    );
  }

  const filterNames: Record<keyof FilterSettings, string> = {
    brightness: t('editor.brightness'),
    contrast: t('editor.contrast'),
    saturation: t('editor.saturation'),
    warmth: t('editor.warmth'),
    tint: t('editor.tint'),
    vignette: t('editor.vignette'),
    sharpness: t('editor.sharpness'),
    grain: t('editor.grain'),
    exposure: 'Exposure',
    highlights: 'Highlights',
    shadows: 'Shadows',
    fade: 'Fade',
  };

  return (
    <div className="flex h-full w-full" style={{ flex: 1, width: '100%', height: '100%', overflow: 'hidden' }}>
      {/* Left: Photo list + controls */}
      <div className="app-sidebar" style={{ width: 280, minWidth: 280, flexShrink: 0 }}>
        <div className="section-header">{t('editor.photos')}</div>
        <div style={{ padding: '0 10px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {photos.map((photo, i) => (
            <div
              key={photo.id}
              className={`thumbnail-item ${selectedId === photo.id ? 'selected' : ''}`}
              style={{ width: '100%', height: 70, flexShrink: 0, cursor: 'pointer' }}
              onClick={() => setSelectedId(photo.id)}
            >
              <img
                src={photo.editedDataUrl ?? photo.dataUrl}
                alt={`Photo ${i + 1}`}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <div className="thumbnail-badge">{i + 1}</div>
            </div>
          ))}
        </div>

        {/* Apply to all */}
        <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border-subtle)' }}>
          <label className="flex items-center gap-2" style={{ cursor: 'pointer', fontSize: 13 }}>
            <input
              type="checkbox"
              checked={applyToAll}
              onChange={(e) => setApplyToAll(e.target.checked)}
            />
            {t('editor.applyToAll')}
          </label>
        </div>

        {/* Filter actions */}
        <div style={{ padding: '0 12px 12px', display: 'flex', gap: 6 }}>
          <button className="btn btn-secondary flex-1" style={{ fontSize: 12 }} onClick={resetEdit}>
            <RotateCcw size={14} /> {t('editor.reset')}
          </button>
          <button className="btn btn-secondary flex-1" style={{ fontSize: 12 }} onClick={rotatePhoto}>
            <RotateCcw size={14} style={{ transform: 'scaleX(-1)' }} /> {t('editor.rotate')}
          </button>
          <button className="btn btn-secondary flex-1" style={{ fontSize: 12 }} onClick={flipPhoto}>
            <FlipHorizontal size={14} /> {t('editor.flip')}
          </button>
        </div>

        {/* Editor Tabs: LUT Phim / Phong cách / Tinh chỉnh */}
        <div style={{ padding: '0 12px 10px' }}>
          <div className="tab-bar">
            <button
              className={`tab-item ${activeTab === 'lut' ? 'active' : ''}`}
              onClick={() => setActiveTab('lut')}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
            >
              <Film size={13} />
              <span>{t('editor.lut')}</span>
            </button>
            <button
              className={`tab-item ${activeTab === 'presets' ? 'active' : ''}`}
              onClick={() => setActiveTab('presets')}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
            >
              <Palette size={13} />
              <span>{t('editor.presets')}</span>
            </button>
            <button
              className={`tab-item ${activeTab === 'adjust' ? 'active' : ''}`}
              onClick={() => setActiveTab('adjust')}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
            >
              <Sliders size={13} />
              <span>{t('editor.filters')}</span>
            </button>
          </div>
        </div>

        {/* Tab 1: 3D LUT Color Grading */}
        {activeTab === 'lut' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '0 12px 16px' }}>
            {/* LUT Intensity Slider */}
            {currentEdit.lutId && currentEdit.lutId !== 'none' && (
              <div
                style={{
                  padding: '8px 12px',
                  background: 'var(--surface-card)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div className="flex justify-between" style={{ fontSize: 12, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600 }}>{t('editor.lutIntensity')}</span>
                  <span style={{ color: 'var(--brand-primary)', fontWeight: 700 }}>{currentEdit.lutIntensity ?? 100}%</span>
                </div>
                <input
                  type="range"
                  className="range-input"
                  min="10"
                  max="100"
                  value={currentEdit.lutIntensity ?? 100}
                  onChange={(e) => updateLutIntensity(Number(e.target.value))}
                />
              </div>
            )}

            {/* LUT Presets Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {lutPresets.map((preset) => {
                const isSelected = (currentEdit.lutId ?? 'none') === preset.id;
                return (
                  <button
                    key={preset.id}
                    className={`filter-preset ${isSelected ? 'active' : ''}`}
                    onClick={() => applyLut(preset.id)}
                    title={preset.description}
                  >
                    <div
                      className="filter-preset-thumb"
                      style={{
                        background: preset.id === 'none'
                          ? 'var(--neutral-200)'
                          : `linear-gradient(135deg, ${preset.accentColor}, #1e293b)`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontWeight: 800,
                        fontSize: 9,
                        letterSpacing: '0.05em',
                      }}
                    >
                      {preset.badge}
                    </div>
                    <div className="filter-preset-label">{preset.name}</div>
                  </button>
                );
              })}
            </div>

            {/* Export LUT Strip Button */}
            {currentEdit.lutId && currentEdit.lutId !== 'none' && (
              <button
                className="btn btn-secondary btn-sm"
                style={{ fontSize: 11, marginTop: 4, width: '100%', justifyContent: 'center' }}
                onClick={() => {
                  const url = generateLutStripAsset(currentEdit.lutId!);
                  if (url) {
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `lut_${currentEdit.lutId}.png`;
                    a.click();
                    toast(t('camera.lutExportAsset') + ' ✓', 'success');
                  }
                }}
              >
                <Download size={13} /> {t('camera.lutExportAsset')}
              </button>
            )}
          </div>
        )}

        {/* Tab 2: Standard Filter presets */}
        {activeTab === 'presets' && (
          <div style={{ padding: '0 12px 16px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
            {filterPresets.map((preset) => (
              <button
                key={preset.id}
                className={`filter-preset ${currentEdit.presetId === preset.id ? 'active' : ''}`}
                onClick={() => applyPreset(preset.id)}
                title={preset.name}
              >
                <div className="filter-preset-thumb" style={{
                  background: preset.id === 'bw' ? 'linear-gradient(135deg, #666, #ccc)' :
                    preset.id === 'warm' ? 'linear-gradient(135deg, #f97316, #fde68a)' :
                    preset.id === 'cool' ? 'linear-gradient(135deg, #60a5fa, #a5f3fc)' :
                    preset.id === 'vintage' ? 'linear-gradient(135deg, #a16207, #fef3c7)' :
                    preset.id === 'pastel' ? 'linear-gradient(135deg, #f9a8d4, #c4b5fd)' :
                    preset.id === 'korean' ? 'linear-gradient(135deg, #fbcfe8, #fce7f3)' :
                    'linear-gradient(135deg, #e5e7eb, #f9fafb)',
                }} />
                <div className="filter-preset-label">{preset.name}</div>
              </button>
            ))}
          </div>
        )}

        {/* Tab 3: Manual fine-tuning adjustments */}
        {activeTab === 'adjust' && (
          <div style={{ padding: '0 12px', display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 16 }}>
            {(Object.keys(defaultFilterSettings) as (keyof FilterSettings)[]).map((key) => (
              <SliderRow
                key={key}
                label={filterNames[key] || (key.charAt(0).toUpperCase() + key.slice(1))}
                value={currentEdit.filter[key]}
                min={key === 'fade' || key === 'vignette' || key === 'grain' || key === 'sharpness' ? 0 : -100}
                max={100}
                onChange={(v) => updateFilter(key, v)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Main: preview */}
      <div className="app-main" style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        gap: 16,
        flex: 1,
        width: '100%',
        height: '100%',
        minWidth: 0,
        overflow: 'hidden',
      }}>
        {/* Navigation */}
        <div className="flex items-center gap-3">
          <button className="btn btn-icon btn-secondary" onClick={goPrev} disabled={photos.indexOf(selectedPhoto!) <= 0}>
            <ArrowLeft size={18} />
          </button>
          <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
            {photos.indexOf(selectedPhoto!) + 1} / {photos.length}
          </span>
          <button className="btn btn-icon btn-secondary" onClick={goNext} disabled={photos.indexOf(selectedPhoto!) >= photos.length - 1}>
            <ArrowRight size={18} />
          </button>
          <button
            className={`btn btn-icon ${compareMode ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setCompareMode((v) => !v)}
            title={t('editor.compare')}
            aria-label={t('editor.compare')}
          >
            {compareMode ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        {/* Preview */}
        {selectedPhoto && (
          <div style={{
            position: 'relative',
            maxWidth: '100%',
            maxHeight: 'calc(100vh - 220px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: 'auto',
          }}>
            <FilteredPreview
              key={`${selectedPhoto.id}-${previewKey}`}
              photo={selectedPhoto}
              editState={currentEdit}
              compareMode={compareMode}
              beforeLabel={t('editor.before')}
              afterLabel={t('editor.after')}
            />
          </div>
        )}

        {/* Continue button */}
        <button
          id="go-to-export-btn"
          className="btn btn-primary btn-lg"
          onClick={() => setView('export')}
          style={{ marginTop: 8 }}
        >
          {t('editor.continueToExport')}
        </button>
      </div>
    </div>
  );
}

function FilteredPreview({
  photo,
  editState,
  compareMode,
  beforeLabel,
  afterLabel,
}: {
  photo: Photo;
  editState: PhotoEditState;
  compareMode: boolean;
  beforeLabel: string;
  afterLabel: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const maxW = Math.min(img.naturalWidth, 700);
      const scale = maxW / img.naturalWidth;
      canvas.width = maxW;
      canvas.height = img.naturalHeight * scale;

      const filtered = applyFiltersToCanvas(
        img,
        editState.filter,
        canvas.width,
        canvas.height,
        editState.lutId,
        editState.lutIntensity
      );
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.save();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        ctx.translate(cx, cy);
        ctx.rotate(((editState.crop.rotation ?? 0) * Math.PI) / 180);
        if (editState.crop.flipH) ctx.scale(-1, 1);
        ctx.drawImage(filtered, -cx, -cy, canvas.width, canvas.height);
        ctx.restore();
      }
      setLoaded(true);
    };
    img.src = photo.dataUrl;
  }, [photo.dataUrl, editState]);

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {/* Original (compare mode) */}
      {compareMode && (
        <img
          src={photo.dataUrl}
          alt="Original"
          style={{
            position: 'absolute',
            inset: 0,
            width: '50%',
            height: '100%',
            objectFit: 'cover',
            clipPath: 'inset(0 50% 0 0)',
            borderRadius: 'var(--radius-lg) 0 0 var(--radius-lg)',
          }}
        />
      )}
      <canvas
        ref={canvasRef}
        style={{
          maxWidth: '100%',
          maxHeight: 'calc(100vh - 250px)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-xl)',
          display: 'block',
          opacity: loaded ? 1 : 0,
          transition: 'opacity 0.2s',
          clipPath: compareMode ? 'inset(0 0 0 50%)' : undefined,
        }}
      />
      {compareMode && (
        <>
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 2,
            height: '100%',
            background: 'white',
            boxShadow: '0 0 8px rgba(0,0,0,0.5)',
          }} />
          <div style={{
            position: 'absolute',
            bottom: 8,
            left: '25%',
            transform: 'translateX(-50%)',
            fontSize: 11,
            fontWeight: 700,
            color: 'white',
            background: 'rgba(0,0,0,0.5)',
            padding: '2px 8px',
            borderRadius: 99,
          }}>{beforeLabel}</div>
          <div style={{
            position: 'absolute',
            bottom: 8,
            left: '75%',
            transform: 'translateX(-50%)',
            fontSize: 11,
            fontWeight: 700,
            color: 'white',
            background: 'rgba(0,0,0,0.5)',
            padding: '2px 8px',
            borderRadius: 99,
          }}>{afterLabel}</div>
        </>
      )}
    </div>
  );
}
