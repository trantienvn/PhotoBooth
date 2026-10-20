// ============================================================
// Core Domain Types for LumiBooth
// ============================================================

// --- Photo ---
export interface Photo {
  id: string;
  sessionId: string;
  index: number; // position in the session
  dataUrl: string; // base64 data URL (original)
  editedDataUrl?: string; // base64 after edits
  capturedAt: number; // timestamp
  width: number;
  height: number;
  editState?: PhotoEditState;
}

// --- Session ---
export type SessionStatus =
  | 'idle'
  | 'preparing'
  | 'countdown'
  | 'capturing'
  | 'reviewing'
  | 'editing'
  | 'exporting'
  | 'completed'
  | 'cancelled';

export interface CaptureSession {
  id: string;
  mode: CaptureMode;
  totalCount: number; // how many photos to take
  capturedCount: number; // how many taken so far
  photos: Photo[];
  status: SessionStatus;
  createdAt: number;
  completedAt?: number;
  templateId?: string;
  timelapseBlob?: Blob;
  timelapseUrl?: string;
}

export type CaptureMode = 'single' | 'photobooth' | 'free';

// --- Filter / Edit ---
export interface FilterSettings {
  brightness: number;   // -100 to 100, default 0
  contrast: number;     // -100 to 100, default 0
  saturation: number;   // -100 to 100, default 0
  exposure: number;     // -100 to 100, default 0
  warmth: number;       // -100 to 100, default 0
  tint: number;         // -100 to 100, default 0
  highlights: number;   // -100 to 100, default 0
  shadows: number;      // -100 to 100, default 0
  fade: number;         // 0 to 100, default 0
  vignette: number;     // 0 to 100, default 0
  grain: number;        // 0 to 100, default 0
  sharpness: number;    // 0 to 100, default 0
}

export const defaultFilterSettings: FilterSettings = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  exposure: 0,
  warmth: 0,
  tint: 0,
  highlights: 0,
  shadows: 0,
  fade: 0,
  vignette: 0,
  grain: 0,
  sharpness: 0,
};

// --- Live Beauty & Retouch Settings ---
export interface BeautySettings {
  enabled: boolean;
  smooth: number;       // 0 to 100 (làm mịn da / blur micro-imperfections)
  rosyGlow: number;     // 0 to 100 (sắc hồng hào tự nhiên)
  brighten: number;     // 0 to 100 (làm sáng da)
  contrast: number;     // -50 to 50 (độ tương phản)
  warmth: number;       // -50 to 50 (tông da ấm / lạnh)
  presetId?: 'off' | 'natural' | 'rosy' | 'porcelain' | 'korean';
}

export const defaultBeautySettings: BeautySettings = {
  enabled: false,
  smooth: 0,
  rosyGlow: 0,
  brighten: 0,
  contrast: 0,
  warmth: 0,
  presetId: 'off',
};

export type FilterPresetName =
  | 'original'
  | 'natural'
  | 'warm'
  | 'cool'
  | 'vintage'
  | 'retro'
  | 'bw'
  | 'soft'
  | 'pastel'
  | 'cinematic'
  | 'korean'
  | 'highcontrast';

export interface FilterPreset {
  id: FilterPresetName;
  name: string;
  settings: FilterSettings;
}

export interface CropState {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  flipH: boolean;
  zoom: number; // 1.0 = 100%
}

export const defaultCropState: CropState = {
  x: 0,
  y: 0,
  width: 1,
  height: 1,
  rotation: 0,
  flipH: false,
  zoom: 1,
};

export interface PhotoEditState {
  filter: FilterSettings;
  crop: CropState;
  presetId?: FilterPresetName;
}

export const defaultPhotoEditState: PhotoEditState = {
  filter: defaultFilterSettings,
  crop: defaultCropState,
};

// --- Sticker / Text ---
export type LayerType = 'text' | 'sticker' | 'emoji';

export interface BaseLayer {
  id: string;
  type: LayerType;
  x: number;     // relative 0-1
  y: number;     // relative 0-1
  rotation: number;
  scale: number;
  zIndex: number;
}

export interface TextLayer extends BaseLayer {
  type: 'text';
  content: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  align: 'left' | 'center' | 'right';
  bold: boolean;
  italic: boolean;
}

export interface StickerLayer extends BaseLayer {
  type: 'sticker';
  src: string; // SVG data URL or asset path
  alt: string;
}

export interface EmojiLayer extends BaseLayer {
  type: 'emoji';
  emoji: string;
  fontSize: number;
}

export type Layer = TextLayer | StickerLayer | EmojiLayer;

// --- Template ---
export interface TemplatePhotoSlot {
  x: number;      // 0-1 relative to canvas width
  y: number;      // 0-1 relative to canvas height
  width: number;  // 0-1 relative to canvas width
  height: number; // 0-1 relative to canvas height
  borderRadius?: number; // px
}

export interface TemplateConfig {
  id: string;
  name: string;
  category: TemplateCategory;
  photoCount: number; // number of photos this template supports
  canvasWidth: number;
  canvasHeight: number;
  backgroundColor: string;
  backgroundPattern?: string; // CSS gradient or pattern identifier
  slots: TemplatePhotoSlot[];
  borderColor?: string;
  borderWidth?: number;
  gap?: number;
  padding?: number;
  hasDateArea?: boolean;
  hasCaptionArea?: boolean;
  hasWatermark?: boolean;
  tags?: string[];
  description?: string;
}

export type TemplateCategory =
  | 'classic'
  | 'korean'
  | 'retro'
  | 'polaroid'
  | 'minimal'
  | 'pastel'
  | 'birthday'
  | 'couple'
  | 'friendship'
  | 'vintage'
  | 'collage'
  | 'free';

// --- Export ---
export type ExportFormat = 'png' | 'jpeg' | 'webp';
export type ExportPreset = 'standard' | 'hires' | 'print' | 'social';

export interface ExportOptions {
  format: ExportFormat;
  quality: number;      // 0-1 for jpeg/webp
  preset: ExportPreset;
  scale: number;        // multiplier, e.g. 2 for 2x
  includeWatermark: boolean;
  filename?: string;
}

export const defaultExportOptions: ExportOptions = {
  format: 'png',
  quality: 0.92,
  preset: 'standard',
  scale: 1,
  includeWatermark: true,
};

// --- Timelapse ---
export type TimelapseStatus = 'idle' | 'recording' | 'paused' | 'stopped' | 'processing';

export interface TimelapseState {
  status: TimelapseStatus;
  startedAt?: number;
  duration: number; // ms elapsed
  estimatedSize: number; // bytes
  blobUrl?: string;
  mimeType?: string;
}

// --- Camera ---
export type Resolution = '480p' | '720p' | '1080p' | 'best';

export interface CameraSettings {
  deviceId?: string;
  resolution: Resolution;
  mirror: boolean;
  showGrid: boolean;
  facing?: 'user' | 'environment';
}

export const defaultCameraSettings: CameraSettings = {
  resolution: '720p',
  mirror: true,
  showGrid: false,
};

export interface CameraDevice {
  deviceId: string;
  label: string;
  facing?: 'user' | 'environment';
}

export interface CameraCapabilities {
  zoom: boolean;
  brightness: boolean;
  contrast: boolean;
  torch: boolean;
  minZoom?: number;
  maxZoom?: number;
}

// --- App Settings ---
export interface AppSettings {
  camera: CameraSettings;
  countdownSeconds: number;      // 0 | 3 | 5 | 10
  defaultPhotoCount: number;
  delayBetweenShots: number;     // ms
  soundEnabled: boolean;
  mirrorCapture: boolean;
  autoTimelapse: boolean;
  theme: 'light' | 'dark' | 'system';
  showWatermark: boolean;
  language: 'vi' | 'en';
}

export const defaultAppSettings: AppSettings = {
  camera: defaultCameraSettings,
  countdownSeconds: 3,
  defaultPhotoCount: 4,
  delayBetweenShots: 1500,
  soundEnabled: true,
  mirrorCapture: true,
  autoTimelapse: true,
  theme: 'system',
  showWatermark: true,
  language: 'vi',
};

// --- Editor State ---
export interface EditorState {
  selectedPhotoId?: string;
  applyToAll: boolean;
  compareMode: boolean;
  undoStack: PhotoEditState[];
  redoStack: PhotoEditState[];
}

// --- Decoration ---
export interface PhotostripDecoration {
  layers: Layer[];
  caption?: string;
  dateLine?: string;
  showDate: boolean;
  showCaption: boolean;
}

export const defaultDecoration: PhotostripDecoration = {
  layers: [],
  showDate: false,
  showCaption: false,
};
