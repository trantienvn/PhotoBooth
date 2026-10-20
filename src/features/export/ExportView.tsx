import { useState, useEffect, useCallback } from 'react';
import { Download } from 'lucide-react';
import { useAppContext } from '@/app/AppContext';
import { templates, getCompatibleTemplates } from '@/services/templates.service';
import { renderTemplate, renderTemplateThumbnail } from '@/services/template-renderer.service';
import { downloadDataUrl, downloadAllAsZip, isWebPSupported } from '@/services/export.service';
import type { ExportOptions, ExportFormat, PhotostripDecoration, TemplateConfig } from '@/types';
import { defaultExportOptions } from '@/types';

export function ExportView() {
  const { currentSession, editStates, selectedTemplate, setSelectedTemplate, decoration, setDecoration, toast, setView } = useAppContext();

  const photos = currentSession?.photos ?? [];
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    ...defaultExportOptions,
    includeWatermark: true,
  });
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [activeTab, setActiveTab] = useState<'template' | 'decoration' | 'single'>('template');
  const [caption, setCaption] = useState(decoration.caption ?? '');
  const [showDate, setShowDate] = useState(decoration.showDate);
  const [supportsWebP] = useState(isWebPSupported());

  const compatibleTemplates = getCompatibleTemplates(photos.length);
  const allTemplates = compatibleTemplates.length > 0 ? compatibleTemplates : templates;

  // Auto-select first compatible template
  useEffect(() => {
    if (!selectedTemplate && allTemplates.length > 0) {
      setSelectedTemplate(allTemplates[0]);
    }
  }, [allTemplates, selectedTemplate, setSelectedTemplate]);

  // Auto-render preview when template or options change
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
    const timeout = setTimeout(render, 300); // debounce
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
      toast('Photostrip downloaded!', 'success');
    } catch (err) {
      toast('Export failed. Please try again.', 'error');
      console.error(err);
    }
    setIsRendering(false);
  }, [selectedTemplate, photos, editStates, exportOptions, decoration, caption, showDate, toast]);

  const handleExportAll = useCallback(async () => {
    if (!currentSession || photos.length === 0) return;
    try {
      toast('Creating ZIP file…', 'info');
      await downloadAllAsZip(photos, currentSession.id, exportOptions.format, exportOptions.quality);
      toast('All photos downloaded!', 'success');
    } catch {
      toast('ZIP export failed.', 'error');
    }
  }, [currentSession, photos, exportOptions, toast]);

  const handleExportSingle = useCallback((photo: typeof photos[0]) => {
    const filename = `lumibooth_${photo.index + 1}_${Date.now()}.${exportOptions.format}`;
    downloadDataUrl(photo.editedDataUrl ?? photo.dataUrl, filename);
    toast(`Photo ${photo.index + 1} downloaded`, 'success');
  }, [exportOptions, toast]);

  if (photos.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center" style={{ flex: 1, width: '100%', height: '100%' }}>
        <div className="empty-state">
          <div className="empty-icon"><Download size={32} /></div>
          <h3 style={{ fontWeight: 600 }}>Nothing to export</h3>
          <p>Capture photos first.</p>
          <button className="btn btn-primary" onClick={() => setView('camera')}>Go to Camera</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full" style={{ flex: 1, width: '100%', height: '100%', overflow: 'hidden' }}>
      {/* Left sidebar */}
      <div className="app-sidebar" style={{ width: 320, minWidth: 320, flexShrink: 0 }}>
        {/* Tabs */}
        <div style={{ padding: '10px 10px 0' }}>
          <div className="tab-bar">
            <button className={`tab-item ${activeTab === 'template' ? 'active' : ''}`} onClick={() => setActiveTab('template')} style={{ fontSize: 11 }}>Template</button>
            <button className={`tab-item ${activeTab === 'decoration' ? 'active' : ''}`} onClick={() => setActiveTab('decoration')} style={{ fontSize: 11 }}>Decorate</button>
            <button className={`tab-item ${activeTab === 'single' ? 'active' : ''}`} onClick={() => setActiveTab('single')} style={{ fontSize: 11 }}>Singles</button>
          </div>
        </div>

        {activeTab === 'template' && (
          <>
            <div className="section-header">Templates ({compatibleTemplates.length} match)</div>
            {compatibleTemplates.length === 0 && (
              <div style={{ padding: '0 12px', fontSize: 12, color: 'var(--color-warning)' }}>
                No exact match for {photos.length} photos. Showing all.
              </div>
            )}
            <div style={{ padding: '0 10px 10px', overflowY: 'auto', maxHeight: 400 }}>
              <div className="template-grid">
                {allTemplates.map((t) => (
                  <TemplateThumbnailCard
                    key={t.id}
                    template={t}
                    selected={selectedTemplate?.id === t.id}
                    onSelect={() => setSelectedTemplate(t)}
                  />
                ))}
              </div>
            </div>

            {/* Template customization */}
            {selectedTemplate && (
              <>
                <div className="section-header">Customize</div>
                <div style={{ padding: '0 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    Background color
                    <input
                      type="color"
                      defaultValue={selectedTemplate.backgroundColor}
                      onChange={(e) => setSelectedTemplate({ ...selectedTemplate, backgroundColor: e.target.value })}
                      style={{ marginLeft: 8, cursor: 'pointer' }}
                    />
                  </label>
                  <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    Border color
                    <input
                      type="color"
                      defaultValue={selectedTemplate.borderColor ?? '#e5e7eb'}
                      onChange={(e) => setSelectedTemplate({ ...selectedTemplate, borderColor: e.target.value })}
                      style={{ marginLeft: 8, cursor: 'pointer' }}
                    />
                  </label>
                  <label className="flex items-center gap-2" style={{ fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={exportOptions.includeWatermark}
                      onChange={(e) => setExportOptions((o) => ({ ...o, includeWatermark: e.target.checked }))}
                    />
                    Show watermark
                  </label>
                </div>
              </>
            )}
          </>
        )}

        {activeTab === 'decoration' && (
          <>
            <div className="section-header">Caption</div>
            <div style={{ padding: '0 12px 12px' }}>
              <input
                className="input"
                placeholder="Add a caption…"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
              />
            </div>
            <div style={{ padding: '0 12px 12px' }}>
              <label className="flex items-center gap-2" style={{ fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={showDate} onChange={(e) => setShowDate(e.target.checked)} />
                Show date ({new Date().toLocaleDateString()})
              </label>
            </div>
            <div className="section-header">Emoji Decoration</div>
            <div style={{ padding: '0 12px 12px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {['🌸', '✨', '💕', '🎀', '⭐', '🎉', '💫', '🌟', '🦋', '🌈', '💖', '🔮'].map((emoji) => (
                <button
                  key={emoji}
                  className="btn btn-secondary"
                  style={{ width: 36, height: 36, fontSize: 18, padding: 0 }}
                  onClick={() => {
                    const layer = {
                      id: Math.random().toString(36).slice(2),
                      type: 'emoji' as const,
                      emoji,
                      fontSize: 32,
                      x: 0.5,
                      y: 0.5,
                      rotation: 0,
                      scale: 1,
                      zIndex: decoration.layers.length,
                    };
                    setDecoration({ ...decoration, layers: [...decoration.layers, layer] });
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </>
        )}

        {activeTab === 'single' && (
          <>
            <div className="section-header">Download Individual Photos</div>
            <div style={{ padding: '0 10px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {photos.map((photo, i) => (
                <div key={photo.id} className="flex items-center gap-2" style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-md)', padding: 8, border: '1px solid var(--border-subtle)' }}>
                  <img src={photo.editedDataUrl ?? photo.dataUrl} alt={`Photo ${i + 1}`} style={{ width: 50, height: 50, objectFit: 'cover', borderRadius: 'var(--radius-sm)' }} />
                  <span style={{ flex: 1, fontSize: 13, color: 'var(--text-secondary)' }}>Photo {i + 1}</span>
                  <button className="btn btn-icon btn-secondary" onClick={() => handleExportSingle(photo)} title="Download">
                    <Download size={14} />
                  </button>
                </div>
              ))}
            </div>
            <div style={{ padding: '0 12px 12px' }}>
              <button className="btn btn-secondary w-full" onClick={handleExportAll}>
                📦 Download All as ZIP
              </button>
            </div>
          </>
        )}

        {/* Export format options */}
        <div className="section-header" style={{ marginTop: 'auto' }}>Export Format</div>
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
                <span className="slider-label">Quality</span>
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

      {/* Main: preview + export button */}
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
        position: 'relative',
        overflow: 'hidden',
      }}>
        {isRendering && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3 }}>
            <div style={{ height: '100%', background: 'var(--brand-gradient)', width: `${renderProgress * 100}%`, transition: 'width 0.3s' }} />
          </div>
        )}

        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20, textAlign: 'center' }}>
          {selectedTemplate?.name ?? 'Choose a Template'}
        </h2>

        {/* Preview */}
        {previewDataUrl && !isRendering && (
          <div style={{
            maxHeight: 'calc(100vh - 240px)',
            overflow: 'auto',
            borderRadius: 'var(--radius-xl)',
            boxShadow: 'var(--shadow-xl)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: 'auto',
          }}>
            <img
              src={previewDataUrl}
              alt="Photostrip preview"
              style={{ display: 'block', maxWidth: '100%', maxHeight: 'calc(100vh - 240px)', objectFit: 'contain', borderRadius: 'var(--radius-xl)' }}
            />
          </div>
        )}

        {(isRendering || !previewDataUrl) && (
          <div style={{
            width: 200, height: 300,
            background: 'var(--neutral-100)',
            borderRadius: 'var(--radius-xl)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 12, color: 'var(--text-tertiary)',
            margin: 'auto',
          }}>
            <div className="spinner" style={{ width: 32, height: 32 }} />
            <span style={{ fontSize: 13 }}>Rendering preview…</span>
          </div>
        )}

        {/* Export button */}
        <button
          id="export-photostrip-btn"
          className="btn btn-primary btn-xl"
          onClick={handleExportPhotostrip}
          disabled={isRendering || !selectedTemplate || photos.length === 0}
          style={{ minWidth: 240 }}
        >
          {isRendering ? (
            <><div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />Exporting…</>
          ) : (
            <><Download size={20} />Download Photostrip</>
          )}
        </button>
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
