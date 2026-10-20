import { useState, useEffect, useCallback, useRef } from 'react';
import { Download, Video, Trash2, Copy, Move, Type, Smile, Sparkles } from 'lucide-react';
import { useAppContext } from '@/app/AppContext';
import { templates, getCompatibleTemplates } from '@/services/templates.service';
import { renderTemplate, renderTemplateThumbnail } from '@/services/template-renderer.service';
import { downloadDataUrl, downloadAllAsZip, isWebPSupported } from '@/services/export.service';
import type { ExportOptions, ExportFormat, PhotostripDecoration, TemplateConfig, Layer, TextLayer, EmojiLayer } from '@/types';
import { defaultExportOptions } from '@/types';

const EMOJI_CATEGORIES = [
  {
    nameKey: '💖 Hearts',
    items: ['💕', '💖', '💗', '💓', '💘', '❤️', '🤍', '💌', '🫶', '💝', '🌸', '🌹'],
  },
  {
    nameKey: '✨ Stars & Sparkles',
    items: ['✨', '🌟', '⭐', '💫', '🌠', '🌙', '☀️', '⚡', '🫧', '🪐', '🔮', '💎'],
  },
  {
    nameKey: '🎀 Cute & Y2K',
    items: ['🎀', '🍒', '🍓', '🧸', '🦋', '👑', '💿', '📷', '🎧', '🦄', '🎈', '🍭'],
  },
  {
    nameKey: '🎉 Celebration',
    items: ['🎉', '🎂', '🥂', '🍾', '🎁', '🥳', '🎊', '🎈', '🪄', '🕯️', '🍰', '🧁'],
  },
  {
    nameKey: '🥰 Mood & Faces',
    items: ['🥰', '😍', '🤪', '🥺', '😎', '🥹', '🤭', '✌️', '🤙', '🫰', '😻', '🔥'],
  },
];

const FONT_FAMILIES = [
  { id: 'Outfit, sans-serif', label: 'Outfit (Modern)' },
  { id: 'Inter, sans-serif', label: 'Inter (Clean)' },
  { id: 'Caveat, cursive', label: 'Caveat (Handwritten)' },
  { id: 'Playfair Display, serif', label: 'Playfair (Elegant)' },
  { id: 'Impact, sans-serif', label: 'Impact (Bold)' },
  { id: 'Courier New, monospace', label: 'Typewriter (Retro)' },
];

const COLOR_PRESETS = [
  '#ffffff', '#000000', '#f43f5e', '#ec4899', '#a855f7',
  '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#fbbf24',
];

export function ExportView() {
  const { currentSession, editStates, selectedTemplate, setSelectedTemplate, decoration, setDecoration, toast, setView, t } = useAppContext();

  const photos = currentSession?.photos ?? [];
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    ...defaultExportOptions,
    includeWatermark: true,
  });
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [activeTab, setActiveTab] = useState<'template' | 'decoration' | 'single' | 'timelapse'>('template');
  const [caption, setCaption] = useState(decoration.caption ?? '');
  const [showDate, setShowDate] = useState(decoration.showDate);
  const [supportsWebP] = useState(isWebPSupported());

  // Interactive Layer Drag & Drop State
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ startX: number; startY: number; initialLayerX: number; initialLayerY: number } | null>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  // New text input states
  const [newTextContent, setNewTextContent] = useState('');
  const [newTextFont, setNewTextFont] = useState('Outfit, sans-serif');
  const [newTextColor, setNewTextColor] = useState('#ffffff');
  const [newTextSize, setNewTextSize] = useState(28);
  const [newTextBold, setNewTextBold] = useState(true);
  const [newTextItalic, setNewTextItalic] = useState(false);

  const compatibleTemplates = getCompatibleTemplates(photos.length);
  const allTemplates = compatibleTemplates.length > 0 ? compatibleTemplates : templates;

  // Auto-select first compatible template
  useEffect(() => {
    if (!selectedTemplate && allTemplates.length > 0) {
      setSelectedTemplate(allTemplates[0]);
    }
  }, [allTemplates, selectedTemplate, setSelectedTemplate]);

  // Auto-render preview when template, options or decorations change
  useEffect(() => {
    if (!selectedTemplate || photos.length === 0) return;
    let cancelled = false;
    const render = async () => {
      setIsRendering(true);
      setRenderProgress(0);
      try {
        const dec: PhotostripDecoration = {
          ...decoration,
          caption,
          showDate,
          dateLine: showDate ? new Date().toLocaleDateString() : undefined,
        };
        const { dataUrl } = await renderTemplate(
          selectedTemplate,
          photos,
          editStates,
          dec,
          { ...exportOptions, scale: 0.4 }, // low-res preview
          (p) => { if (!cancelled) setRenderProgress(p); },
        );
        if (!cancelled) setPreviewDataUrl(dataUrl);
      } catch (err) {
        console.error('Preview render error:', err);
      }
      if (!cancelled) setIsRendering(false);
    };
    const timeout = setTimeout(render, 250); // debounce
    return () => { cancelled = true; clearTimeout(timeout); };
  }, [selectedTemplate, photos, editStates, exportOptions, caption, showDate, decoration]);

  const handleExportPhotostrip = useCallback(async () => {
    if (!selectedTemplate || photos.length === 0) return;
    setIsRendering(true);
    try {
      const dec: PhotostripDecoration = {
        ...decoration,
        caption,
        showDate,
        dateLine: showDate ? new Date().toLocaleDateString() : undefined,
      };
      const { dataUrl } = await renderTemplate(
        selectedTemplate,
        photos,
        editStates,
        dec,
        exportOptions,
        (p) => setRenderProgress(p),
      );
      const ext = exportOptions.format;
      const filename = `lumibooth_${selectedTemplate.id}_${Date.now()}.${ext}`;
      downloadDataUrl(dataUrl, filename);
      toast(t('export.downloadPhotostrip') + ' ✓', 'success');
    } catch (err) {
      toast('Export failed. Please try again.', 'error');
      console.error(err);
    }
    setIsRendering(false);
  }, [selectedTemplate, photos, editStates, exportOptions, decoration, caption, showDate, toast, t]);

  const handleDownloadTimelapse = useCallback(() => {
    if (!currentSession?.timelapseUrl) {
      toast(t('export.noTimelapse'), 'info');
      return;
    }
    const a = document.createElement('a');
    a.href = currentSession.timelapseUrl;
    a.download = `lumibooth_timelapse_${Date.now()}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast(t('export.downloadTimelapse') + ' ✓', 'success');
  }, [currentSession?.timelapseUrl, toast, t]);

  const handleExportAll = useCallback(async () => {
    if (!currentSession || photos.length === 0) return;
    try {
      toast('Creating ZIP file…', 'info');
      await downloadAllAsZip(photos, currentSession.id, exportOptions.format, exportOptions.quality, currentSession.timelapseBlob);
      toast('All photos & timelapse downloaded!', 'success');
    } catch {
      toast('ZIP export failed.', 'error');
    }
  }, [currentSession, photos, exportOptions, toast]);

  const handleExportSingle = useCallback((photo: typeof photos[0]) => {
    const filename = `lumibooth_${photo.index + 1}_${Date.now()}.${exportOptions.format}`;
    downloadDataUrl(photo.editedDataUrl ?? photo.dataUrl, filename);
    toast(`${t('export.downloadSingle')} ${photo.index + 1} ✓`, 'success');
  }, [exportOptions, toast, t]);

  // Layer manipulation helpers
  const handleAddEmoji = (emoji: string) => {
    const newLayer: EmojiLayer = {
      id: Math.random().toString(36).slice(2),
      type: 'emoji',
      emoji,
      fontSize: 36,
      x: 0.45 + Math.random() * 0.1,
      y: 0.45 + Math.random() * 0.1,
      rotation: 0,
      scale: 1,
      zIndex: decoration.layers.length + 1,
    };
    setDecoration((prev: PhotostripDecoration) => ({
      ...prev,
      layers: [...prev.layers, newLayer],
    }));
    setSelectedLayerId(newLayer.id);
  };

  const handleAddText = () => {
    if (!newTextContent.trim()) {
      return;
    }
    const newLayer: TextLayer = {
      id: Math.random().toString(36).slice(2),
      type: 'text',
      content: newTextContent.trim(),
      fontFamily: newTextFont,
      fontSize: newTextSize,
      color: newTextColor,
      align: 'center',
      bold: newTextBold,
      italic: newTextItalic,
      x: 0.5,
      y: 0.5,
      rotation: 0,
      scale: 1,
      zIndex: decoration.layers.length + 1,
    };
    setDecoration((prev: PhotostripDecoration) => ({
      ...prev,
      layers: [...prev.layers, newLayer],
    }));
    setSelectedLayerId(newLayer.id);
    setNewTextContent('');
  };

  const handleDeleteLayer = (id: string) => {
    setDecoration((prev: PhotostripDecoration) => ({
      ...prev,
      layers: prev.layers.filter((l) => l.id !== id),
    }));
    if (selectedLayerId === id) setSelectedLayerId(null);
  };

  const handleDuplicateLayer = (layer: Layer) => {
    const dup = {
      ...layer,
      id: Math.random().toString(36).slice(2),
      x: Math.min(0.9, layer.x + 0.05),
      y: Math.min(0.9, layer.y + 0.05),
      zIndex: decoration.layers.length + 1,
    };
    setDecoration((prev: PhotostripDecoration) => ({
      ...prev,
      layers: [...prev.layers, dup],
    }));
    setSelectedLayerId(dup.id);
  };

  const handleUpdateSelectedLayer = (partial: Partial<Layer>) => {
    if (!selectedLayerId) return;
    setDecoration((prev: PhotostripDecoration) => ({
      ...prev,
      layers: prev.layers.map((l: Layer) => (l.id === selectedLayerId ? ({ ...l, ...partial } as Layer) : l)),
    }));
  };

  // Pointer drag logic
  const handlePointerDown = (e: React.PointerEvent, layer: Layer) => {
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setSelectedLayerId(layer.id);
    setIsDragging(true);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialLayerX: layer.x,
      initialLayerY: layer.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent, layerId: string) => {
    if (!isDragging || !dragStartRef.current || !previewContainerRef.current) return;
    const rect = previewContainerRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const dx = (e.clientX - dragStartRef.current.startX) / rect.width;
    const dy = (e.clientY - dragStartRef.current.startY) / rect.height;

    const newX = Math.max(0.02, Math.min(0.98, dragStartRef.current.initialLayerX + dx));
    const newY = Math.max(0.02, Math.min(0.98, dragStartRef.current.initialLayerY + dy));

    setDecoration((prev: PhotostripDecoration) => ({
      ...prev,
      layers: prev.layers.map((l: Layer) => (l.id === layerId ? ({ ...l, x: newX, y: newY } as Layer) : l)),
    }));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    setIsDragging(false);
    dragStartRef.current = null;
  };

  const selectedLayer = decoration.layers.find((l) => l.id === selectedLayerId);

  if (photos.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center" style={{ flex: 1, width: '100%', height: '100%' }}>
        <div className="empty-state">
          <div className="empty-icon"><Download size={32} /></div>
          <h3 style={{ fontWeight: 600 }}>{t('export.nothingToExport')}</h3>
          <p>{t('export.nothingDesc')}</p>
          <button className="btn btn-primary" onClick={() => setView('camera')}>{t('editor.goToCamera')}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full" style={{ flex: 1, width: '100%', height: '100%', overflow: 'hidden' }}>
      {/* Left sidebar */}
      <div className="app-sidebar" style={{ width: 340, minWidth: 340, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Tabs */}
        <div style={{ padding: '10px 10px 0' }}>
          <div className="tab-bar">
            <button className={`tab-item ${activeTab === 'template' ? 'active' : ''}`} onClick={() => setActiveTab('template')} style={{ fontSize: 11 }}>{t('export.framesTab')}</button>
            <button className={`tab-item ${activeTab === 'decoration' ? 'active' : ''}`} onClick={() => setActiveTab('decoration')} style={{ fontSize: 11 }}>{t('export.decorateTab')}</button>
            <button className={`tab-item ${activeTab === 'single' ? 'active' : ''}`} onClick={() => setActiveTab('single')} style={{ fontSize: 11 }}>{t('export.singlesTab')}</button>
            <button className={`tab-item ${activeTab === 'timelapse' ? 'active' : ''}`} onClick={() => setActiveTab('timelapse')} style={{ fontSize: 11 }}>{t('export.timelapseTab')}</button>
          </div>
        </div>

        {/* Tab 1: Templates / Frames */}
        {activeTab === 'template' && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <div className="section-header">{t('export.templatesMatch', { count: compatibleTemplates.length })}</div>
            {compatibleTemplates.length === 0 && (
              <div style={{ padding: '0 12px', fontSize: 12, color: 'var(--color-warning)' }}>
                {t('export.showingAll', { count: photos.length })}
              </div>
            )}
            <div style={{ padding: '0 10px 10px' }}>
              <div className="template-grid">
                {allTemplates.map((tConfig) => (
                  <TemplateThumbnailCard
                    key={tConfig.id}
                    template={tConfig}
                    selected={selectedTemplate?.id === tConfig.id}
                    onSelect={() => setSelectedTemplate(tConfig)}
                  />
                ))}
              </div>
            </div>

            {/* Template customization */}
            {selectedTemplate && (
              <>
                <div className="section-header">{t('export.frameColors')}</div>
                <div style={{ padding: '0 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <label className="flex items-center justify-between" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    <span>{t('export.bgColor')}</span>
                    <input
                      type="color"
                      value={selectedTemplate.backgroundColor}
                      onChange={(e) => setSelectedTemplate({ ...selectedTemplate, backgroundColor: e.target.value })}
                      style={{ cursor: 'pointer', borderRadius: 4, width: 36, height: 26, border: 'none' }}
                    />
                  </label>
                  <label className="flex items-center justify-between" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    <span>{t('export.borderColor')}</span>
                    <input
                      type="color"
                      value={selectedTemplate.borderColor && selectedTemplate.borderColor !== 'transparent' ? selectedTemplate.borderColor : '#e5e7eb'}
                      onChange={(e) => setSelectedTemplate({ ...selectedTemplate, borderColor: e.target.value, borderWidth: selectedTemplate.borderWidth || 2 })}
                      style={{ cursor: 'pointer', borderRadius: 4, width: 36, height: 26, border: 'none' }}
                    />
                  </label>
                  <label className="flex items-center gap-2" style={{ fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={exportOptions.includeWatermark}
                      onChange={(e) => setExportOptions((o) => ({ ...o, includeWatermark: e.target.checked }))}
                    />
                    {t('export.showWatermark')}
                  </label>
                </div>
              </>
            )}
          </div>
        )}

        {/* Tab 2: Decorate (Text, Icons, Drag & Drop) */}
        {activeTab === 'decoration' && (
          <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 16 }}>
            {/* Header Hint */}
            <div style={{ padding: '8px 12px', background: 'var(--brand-glow)', borderRadius: 'var(--radius-md)', margin: '8px 12px 12px', fontSize: 12, color: 'var(--brand-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sparkles size={16} />
              <span>{t('export.clickToDragHint')}</span>
            </div>

            {/* Caption & Date */}
            <div className="section-header">{t('export.stripHeaderDate')}</div>
            <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input
                className="input"
                placeholder={t('export.stripTitlePlaceholder')}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
              />
              <label className="flex items-center gap-2" style={{ fontSize: 12, cursor: 'pointer', color: 'var(--text-secondary)' }}>
                <input type="checkbox" checked={showDate} onChange={(e) => setShowDate(e.target.checked)} />
                {t('export.showDateStamp', { date: new Date().toLocaleDateString() })}
              </label>
            </div>

            {/* Add Custom Text Layer */}
            <div className="section-header flex items-center gap-1">
              <Type size={14} /> {t('export.addTextLayer')}
            </div>
            <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="flex gap-2">
                <input
                  className="input flex-1"
                  placeholder={t('export.typeWordPlaceholder')}
                  value={newTextContent}
                  onChange={(e) => setNewTextContent(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddText(); }}
                />
                <button className="btn btn-primary" onClick={handleAddText} style={{ padding: '0 12px', fontSize: 12 }}>
                  {t('export.addTextBtn')}
                </button>
              </div>

              {/* Font settings */}
              <div className="flex items-center gap-2">
                <select
                  className="input flex-1"
                  style={{ fontSize: 12, padding: '4px 8px' }}
                  value={newTextFont}
                  onChange={(e) => setNewTextFont(e.target.value)}
                >
                  {FONT_FAMILIES.map((f) => (
                    <option key={f.id} value={f.id}>{f.label}</option>
                  ))}
                </select>
                <button
                  className={`btn btn-secondary ${newTextBold ? 'active' : ''}`}
                  style={{ width: 30, height: 30, padding: 0, fontWeight: 'bold' }}
                  onClick={() => setNewTextBold((b) => !b)}
                  title="Bold"
                >
                  B
                </button>
                <button
                  className={`btn btn-secondary ${newTextItalic ? 'active' : ''}`}
                  style={{ width: 30, height: 30, padding: 0, fontStyle: 'italic' }}
                  onClick={() => setNewTextItalic((i) => !i)}
                  title="Italic"
                >
                  I
                </button>
              </div>

              {/* Text color presets */}
              <div className="flex items-center gap-1" style={{ flexWrap: 'wrap' }}>
                {COLOR_PRESETS.map((color) => (
                  <button
                    key={color}
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      background: color,
                      border: newTextColor === color ? '2px solid var(--brand-primary)' : '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      transform: newTextColor === color ? 'scale(1.15)' : 'none',
                    }}
                    onClick={() => setNewTextColor(color)}
                    aria-label={`Color ${color}`}
                  />
                ))}
                <input
                  type="color"
                  value={newTextColor}
                  onChange={(e) => setNewTextColor(e.target.value)}
                  style={{ width: 24, height: 24, border: 'none', background: 'transparent', cursor: 'pointer', marginLeft: 4 }}
                  title="Custom color"
                />
              </div>

              {/* Font size */}
              <div className="slider-group" style={{ margin: '4px 0 0' }}>
                <div className="slider-label-row">
                  <span className="slider-label" style={{ fontSize: 11 }}>{t('export.fontSize')}</span>
                  <span className="slider-value" style={{ fontSize: 11 }}>{newTextSize}px</span>
                </div>
                <input
                  type="range"
                  className="range-input"
                  min={14}
                  max={64}
                  value={newTextSize}
                  onChange={(e) => setNewTextSize(Number(e.target.value))}
                />
              </div>
            </div>

            {/* Add Icons / Stickers / Emojis */}
            <div className="section-header flex items-center gap-1">
              <Smile size={14} /> {t('export.stickersEmojis')}
            </div>
            <div style={{ padding: '0 12px 12px' }}>
              {EMOJI_CATEGORIES.map((cat) => (
                <div key={cat.nameKey} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 4 }}>
                    {cat.nameKey}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {cat.items.map((emoji) => (
                      <button
                        key={emoji}
                        className="btn btn-secondary"
                        style={{
                          width: 34,
                          height: 34,
                          fontSize: 18,
                          padding: 0,
                          borderRadius: 'var(--radius-md)',
                          transition: 'transform 0.1s',
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.2)'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = ''; }}
                        onClick={() => handleAddEmoji(emoji)}
                        title={`Add ${emoji}`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Selected Layer Inspector */}
            {selectedLayer && (
              <div style={{
                margin: '8px 12px 12px',
                padding: 12,
                background: 'var(--surface-card)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--brand-primary)',
                boxShadow: 'var(--shadow-sm)',
              }}>
                <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand-primary)' }}>
                    {t('export.selected')}: {selectedLayer.type === 'emoji' ? (selectedLayer as EmojiLayer).emoji : `"${(selectedLayer as TextLayer).content}"`}
                  </span>
                  <div className="flex gap-1">
                    <button
                      className="btn btn-icon btn-secondary"
                      style={{ width: 26, height: 26, padding: 0 }}
                      onClick={() => handleDuplicateLayer(selectedLayer)}
                      title={t('export.duplicate')}
                    >
                      <Copy size={13} />
                    </button>
                    <button
                      className="btn btn-icon btn-danger"
                      style={{ width: 26, height: 26, padding: 0 }}
                      onClick={() => handleDeleteLayer(selectedLayer.id)}
                      title={t('export.delete')}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Scale slider */}
                <div className="slider-group" style={{ margin: '4px 0' }}>
                  <div className="slider-label-row">
                    <span className="slider-label" style={{ fontSize: 11 }}>{t('export.scale')}</span>
                    <span className="slider-value" style={{ fontSize: 11 }}>{Math.round(selectedLayer.scale * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    className="range-input"
                    min={40}
                    max={250}
                    value={Math.round(selectedLayer.scale * 100)}
                    onChange={(e) => handleUpdateSelectedLayer({ scale: Number(e.target.value) / 100 })}
                  />
                </div>

                {/* Rotation slider */}
                <div className="slider-group" style={{ margin: '4px 0' }}>
                  <div className="slider-label-row">
                    <span className="slider-label" style={{ fontSize: 11 }}>{t('export.rotation')}</span>
                    <span className="slider-value" style={{ fontSize: 11 }}>{selectedLayer.rotation}°</span>
                  </div>
                  <input
                    type="range"
                    className="range-input"
                    min={-180}
                    max={180}
                    value={selectedLayer.rotation}
                    onChange={(e) => handleUpdateSelectedLayer({ rotation: Number(e.target.value) })}
                  />
                </div>

                {/* If text layer: edit color and text */}
                {selectedLayer.type === 'text' && (
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <input
                      className="input"
                      style={{ fontSize: 12, padding: '4px 8px' }}
                      value={(selectedLayer as TextLayer).content}
                      onChange={(e) => handleUpdateSelectedLayer({ content: e.target.value } as Partial<TextLayer>)}
                    />
                    <div className="flex items-center gap-1" style={{ flexWrap: 'wrap' }}>
                      {COLOR_PRESETS.map((color) => (
                        <button
                          key={color}
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: '50%',
                            background: color,
                            border: (selectedLayer as TextLayer).color === color ? '2px solid var(--brand-primary)' : '1px solid var(--border-subtle)',
                            cursor: 'pointer',
                          }}
                          onClick={() => handleUpdateSelectedLayer({ color } as Partial<TextLayer>)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Layer List */}
            {decoration.layers.length > 0 && (
              <div style={{ padding: '0 12px' }}>
                <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {t('export.layersCount', { count: decoration.layers.length })}
                  </span>
                  <button
                    className="btn btn-secondary"
                    style={{ fontSize: 11, padding: '2px 8px' }}
                    onClick={() => { setDecoration((prev: PhotostripDecoration) => ({ ...prev, layers: [] })); setSelectedLayerId(null); }}
                  >
                    {t('export.clearAll')}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Singles */}
        {activeTab === 'single' && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <div className="section-header">{t('export.individualPhotos', { count: photos.length })}</div>
            <div style={{ padding: '0 10px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {photos.map((photo, i) => (
                <div key={photo.id} className="flex items-center gap-2" style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-md)', padding: 8, border: '1px solid var(--border-subtle)' }}>
                  <img src={photo.editedDataUrl ?? photo.dataUrl} alt={`Photo ${i + 1}`} style={{ width: 50, height: 50, objectFit: 'cover', borderRadius: 'var(--radius-sm)' }} />
                  <span style={{ flex: 1, fontSize: 13, color: 'var(--text-secondary)' }}>Photo {i + 1}</span>
                  <button className="btn btn-icon btn-secondary" onClick={() => handleExportSingle(photo)} title={t('export.downloadSingle')}>
                    <Download size={14} />
                  </button>
                </div>
              ))}
            </div>
            <div style={{ padding: '0 12px 12px' }}>
              <button className="btn btn-secondary w-full" onClick={handleExportAll}>
                {t('export.downloadAllZip')}
              </button>
            </div>
          </div>
        )}

        {/* Tab 4: Timelapse Video */}
        {activeTab === 'timelapse' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
            <div className="section-header" style={{ padding: 0, marginBottom: 8 }}>{t('export.timelapseSection')}</div>
            {currentSession?.timelapseUrl ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{
                  borderRadius: 'var(--radius-lg)',
                  overflow: 'hidden',
                  background: '#000',
                  boxShadow: 'var(--shadow-md)',
                }}>
                  <video
                    src={currentSession.timelapseUrl}
                    controls
                    autoPlay
                    loop
                    playsInline
                    style={{ width: '100%', maxHeight: 240, display: 'block' }}
                  />
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {t('export.timelapseDesc')}
                </div>
                <button
                  className="btn btn-primary w-full"
                  onClick={handleDownloadTimelapse}
                  style={{ gap: 8, padding: '10px 16px' }}
                >
                  <Download size={16} />
                  {t('export.downloadTimelapseBtn')}
                </button>
              </div>
            ) : (
              <div style={{
                padding: '24px 16px',
                textAlign: 'center',
                background: 'var(--surface-card)',
                borderRadius: 'var(--radius-lg)',
                border: '1px dashed var(--border-subtle)',
                color: 'var(--text-secondary)',
              }}>
                <Video size={36} style={{ margin: '0 auto 12px', opacity: 0.6 }} />
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>{t('export.noTimelapse')}</div>
                <div style={{ fontSize: 12, lineHeight: 1.5, marginBottom: 14 }}>
                  {t('export.noTimelapseDesc')}
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => setView('camera')}>
                  {t('editor.goToCamera')}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Export format options */}
        <div className="section-header" style={{ marginTop: 'auto', borderTop: '1px solid var(--border-subtle)' }}>
          {t('export.exportFormat')}
        </div>
        <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="chip-group">
            {(['png', 'jpeg', ...(supportsWebP ? ['webp'] : [])] as ExportFormat[]).map((f) => (
              <button
                key={f}
                className={`chip ${exportOptions.format === f ? 'active' : ''}`}
                onClick={() => setExportOptions((o) => ({ ...o, format: f }))}
              >
                {f.toUpperCase()}
              </button>
            ))}
          </div>
          {exportOptions.format !== 'png' && (
            <div className="slider-group">
              <div className="slider-label-row">
                <span className="slider-label">{t('export.quality')}</span>
                <span className="slider-value">{Math.round(exportOptions.quality * 100)}%</span>
              </div>
              <input
                type="range"
                className="range-input"
                min={50}
                max={100}
                value={Math.round(exportOptions.quality * 100)}
                onChange={(e) => setExportOptions((o) => ({ ...o, quality: Number(e.target.value) / 100 }))}
              />
            </div>
          )}
          <div className="chip-group">
            {[1, 2, 3].map((s) => (
              <button
                key={s}
                className={`chip ${exportOptions.scale === s ? 'active' : ''}`}
                onClick={() => setExportOptions((o) => ({ ...o, scale: s }))}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main: preview + draggable overlay + export button */}
      <div className="app-main" style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        gap: 14,
        flex: 1,
        width: '100%',
        height: '100%',
        minWidth: 0,
        position: 'relative',
        overflow: 'hidden',
      }}>
        {isRendering && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3 }}>
            <div style={{ height: '100%', background: 'var(--brand-gradient)', width: `${renderProgress * 100}%`, transition: 'width 0.3s' }} />
          </div>
        )}

        <div className="flex items-center justify-between" style={{ width: '100%', maxWidth: 600 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20 }}>
            {selectedTemplate?.name ?? 'Choose a Template'}
          </h2>
          {decoration.layers.length > 0 && (
            <div className="badge badge-active" style={{ fontSize: 11 }}>
              {t('export.placedBadge', { count: decoration.layers.length })}
            </div>
          )}
        </div>

        {/* Photostrip Preview Container with Interactive Draggable Overlay */}
        {previewDataUrl && !isRendering && (
          <div
            ref={previewContainerRef}
            style={{
              position: 'relative',
              maxHeight: 'calc(100vh - 230px)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: 'var(--shadow-xl)',
              overflow: 'hidden',
              display: 'inline-block',
              margin: 'auto',
              userSelect: 'none',
            }}
            onClick={() => setSelectedLayerId(null)}
          >
            <img
              src={previewDataUrl}
              alt="Photostrip preview"
              style={{
                display: 'block',
                maxWidth: '100%',
                maxHeight: 'calc(100vh - 230px)',
                objectFit: 'contain',
                pointerEvents: 'none',
              }}
            />

            {/* Interactive draggable layer elements */}
            {decoration.layers.map((layer) => {
              const isSelected = layer.id === selectedLayerId;
              return (
                <div
                  key={layer.id}
                  onPointerDown={(e) => handlePointerDown(e, layer)}
                  onPointerMove={(e) => handlePointerMove(e, layer.id)}
                  onPointerUp={handlePointerUp}
                  style={{
                    position: 'absolute',
                    left: `${layer.x * 100}%`,
                    top: `${layer.y * 100}%`,
                    transform: `translate(-50%, -50%) rotate(${layer.rotation}deg) scale(${layer.scale})`,
                    cursor: isDragging && isSelected ? 'grabbing' : 'grab',
                    zIndex: layer.zIndex + 10,
                    padding: 4,
                    borderRadius: 4,
                    border: isSelected ? '2px dashed var(--brand-primary)' : '1px solid transparent',
                    background: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                    touchAction: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: isDragging ? 'none' : 'border 0.2s',
                  }}
                  title="Drag to position"
                >
                  {layer.type === 'emoji' ? (
                    <span style={{ fontSize: (layer as EmojiLayer).fontSize, lineHeight: 1, userSelect: 'none' }}>
                      {(layer as EmojiLayer).emoji}
                    </span>
                  ) : (
                    <span style={{
                      fontFamily: (layer as TextLayer).fontFamily,
                      fontSize: (layer as TextLayer).fontSize,
                      color: (layer as TextLayer).color,
                      fontWeight: (layer as TextLayer).bold ? 'bold' : 'normal',
                      fontStyle: (layer as TextLayer).italic ? 'italic' : 'normal',
                      whiteSpace: 'nowrap',
                      userSelect: 'none',
                      textShadow: '0 1px 3px rgba(0,0,0,0.4)',
                    }}>
                      {(layer as TextLayer).content}
                    </span>
                  )}
                  {isSelected && (
                    <div style={{
                      position: 'absolute',
                      top: -10,
                      right: -10,
                      background: 'var(--brand-primary)',
                      color: '#fff',
                      borderRadius: '50%',
                      width: 18,
                      height: 18,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 10,
                      boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                    }}>
                      <Move size={10} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {(isRendering || !previewDataUrl) && (
          <div style={{
            width: 220, height: 320,
            background: 'var(--neutral-100)',
            borderRadius: 'var(--radius-xl)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 12, color: 'var(--text-tertiary)',
            margin: 'auto',
          }}>
            <div className="spinner" style={{ width: 32, height: 32 }} />
            <span style={{ fontSize: 13 }}>{t('export.renderingPhotostrip')}</span>
          </div>
        )}

        {/* Action buttons row */}
        <div className="flex items-center gap-3" style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            id="export-photostrip-btn"
            className="btn btn-primary btn-xl"
            onClick={handleExportPhotostrip}
            disabled={isRendering || !selectedTemplate || photos.length === 0}
            style={{ minWidth: 220 }}
          >
            {isRendering ? (
              <><div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} /> {t('export.exporting')}</>
            ) : (
              <><Download size={20} /> {t('export.downloadPhotostrip')}</>
            )}
          </button>

          {currentSession?.timelapseUrl && (
            <button
              id="export-timelapse-btn"
              className="btn btn-secondary btn-xl"
              onClick={handleDownloadTimelapse}
              style={{ gap: 8 }}
            >
              <Video size={18} />
              {t('export.downloadTimelapse')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function TemplateThumbnailCard({ template, selected, onSelect }: {
  template: TemplateConfig;
  selected: boolean;
  onSelect: () => void;
}) {
  const [thumb, setThumb] = useState('');

  useEffect(() => {
    const url = renderTemplateThumbnail(template, 100);
    setThumb(url);
  }, [template]);

  return (
    <div
      className={`template-card ${selected ? 'selected' : ''}`}
      onClick={onSelect}
      role="button"
      aria-pressed={selected}
      aria-label={template.name}
    >
      {thumb && (
        <img
          src={thumb}
          alt={template.name}
          className="template-thumb"
          style={{ maxHeight: 100, objectFit: 'contain', background: '#f9fafb' }}
        />
      )}
      <div className="template-info">
        <div className="template-name">{template.name}</div>
        <div className="template-count">{template.photoCount} photos</div>
      </div>
    </div>
  );
}
