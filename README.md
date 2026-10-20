# LumiBooth 📸

A full-featured, privacy-first web photobooth application built with React + TypeScript + Vite. All processing happens locally in the browser — no uploads, no backend required.

## ✨ Features

- **Live webcam preview** with device selection, mirror, and grid overlay
- **Multiple capture modes**: Single photo, Photobooth strip (3–12+ photos), Free mode
- **Countdown timer** (0, 3, 5, 10 seconds) with audio beeps and flash effect
- **Timelapse recording** using MediaRecorder API (WebM format)
- **12 filter presets**: Original, Natural, Warm, Cool, Vintage, Retro, B&W, Soft, Pastel, Cinematic, Korean, High Contrast
- **Manual adjustments**: Brightness, Contrast, Saturation, Exposure, Warmth, Vignette, Grain, and more
- **Photo transformations**: Rotation, flip, before/after comparison
- **15 template layouts**: Classic strips, Korean booth, Polaroid, Minimal, Pastel, Birthday, Collage grids, etc.
- **Template customization**: Background color, border color, watermark, caption, date
- **Export options**: PNG, JPEG (quality slider), WebP — with 1x/2x/3x scale
- **Bulk ZIP download** of all photos
- **Gallery view** with session management
- **IndexedDB persistence** for sessions and settings
- **Dark/Light theme**
- **Responsive** — works on desktop, tablet, and mobile

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm

### Install & Run

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

> **Note**: Camera access requires HTTPS or localhost. The dev server on `localhost:5173` works without HTTPS.

### Other Commands

```bash
npm run build      # Production build
npm run preview    # Preview production build
npm run test       # Run unit tests
npm run typecheck  # TypeScript type check
npm run lint       # ESLint
```

## 📷 Granting Camera Access

1. Click **"Start Camera"** in the Camera view
2. Your browser will ask for camera permission — click **Allow**
3. If denied, open browser settings and manually allow camera for `localhost`

**Chrome**: Settings → Privacy → Camera → Allow localhost  
**Firefox**: Click the camera icon in the URL bar → Allow  
**Safari**: Preferences → Websites → Camera → Allow

## 🎬 Using Timelapse

1. Start your camera
2. Click **"Record Timelapse"** in the sidebar
3. Take photos during the session — the webcam feed is being recorded
4. Click **Stop** when done
5. Preview the video inline and click **Download Video**

> **Format note**: The app auto-detects the best supported format. Most browsers produce WebM (VP8 or VP9). The file extension matches the actual codec — no fake MP4.

## 🖼️ Photo Capture Workflow

1. **Camera view** → Start camera → Choose mode & count → Click Capture
2. Countdown plays → Flash effect → Photo saved to thumbnail strip
3. After all photos: automatically navigated to **Editor view**
4. Apply filter presets or manual adjustments → Continue to **Export view**
5. Choose template → Customize → Download photostrip

## 📁 Project Structure

```
src/
  app/            # AppContext, App root, routing
  components/     # Shared components (Header, Toast)
  features/
    camera/       # CameraView, webcam handling
    capture/      # CaptureControls, ThumbnailStrip
    photo-editor/ # PhotoEditor with filters & adjustments
    export/       # ExportView with template selection
    gallery/      # GalleryView with session management
    settings/     # SettingsView
  hooks/          # useCamera, useCaptureSession, useTimelapse, useSettings
  services/       # Pure services (camera, image-processing, timelapse, templates, storage, export)
  types/          # All TypeScript types
  styles/         # Global CSS design system
  tests/          # Vitest unit tests
```

## 🌐 Browser Compatibility

| Feature | Chrome/Edge | Firefox | Safari |
|---------|------------|---------|--------|
| Webcam (getUserMedia) | ✅ | ✅ | ✅ |
| MediaRecorder (WebM) | ✅ | ✅ | ❌ (limited) |
| MediaRecorder (MP4) | ❌ | ❌ | ✅ |
| Canvas filters | ✅ | ✅ | ✅ |
| IndexedDB | ✅ | ✅ | ✅ |
| WebP export | ✅ | ✅ | ✅ (Safari 14+) |
| Camera advanced controls (zoom/brightness) | ✅ Chrome | ❌ | ❌ |

> **Safari note**: Video timelapse may not work in Safari due to limited MediaRecorder support. All photo features work normally.

## 🔒 Privacy

- Camera is only activated when you click "Start Camera"
- All image/video processing happens in your browser (no server uploads)
- Photos and sessions are stored in browser IndexedDB (local only)
- Settings are also stored locally
- Click **Settings → Clear All Data** to remove everything
- The camera stream is stopped when you click "Stop Camera"

## ⚙️ Configuration

Key settings are in **Settings view** or `src/types/index.ts` → `defaultAppSettings`.

To rebrand (change name/theme):
1. Update `<title>` in `index.html`
2. Update `LumiBooth` text in `src/components/Header.tsx`
3. Modify CSS variables in `src/styles/global.css` (e.g., `--brand-primary`, `--brand-gradient`)

## 🧪 Testing Webcam in Browser

1. Open Chrome DevTools → Application → Sensors → Camera → select a test camera
2. Or use a virtual camera app (e.g., OBS Virtual Camera, ManyCam)
3. The app auto-lists all camera devices once permission is granted

## Known Limitations

- `OffscreenCanvas` is used conceptually but heavy processing still runs on main thread; for very large exports (>4000px canvas), the UI may briefly block
- The Grain filter uses `Math.random()` which is not deterministic — each render will look slightly different
- Safari does not support `MediaRecorder` for WebM; timelapse recording will silently fail with a console warning

## License

MIT — see LICENSE file.
