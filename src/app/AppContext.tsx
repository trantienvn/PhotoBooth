import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { AppSettings, CaptureSession, PhotoEditState, TemplateConfig, PhotostripDecoration } from '@/types';
import { defaultAppSettings, defaultDecoration } from '@/types';
import { loadSettings, saveSettings } from '@/services/storage.service';
import { translate, type SupportedLanguage } from '@/services/i18n.service';

export type AppView = 'camera' | 'gallery' | 'editor' | 'export' | 'settings';

interface AppContextValue {
  // Settings
  settings: AppSettings;
  updateSettings: (partial: Partial<AppSettings>) => void;
  // Language / i18n
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  // Theme
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  // Session
  currentSession: CaptureSession | null;
  setCurrentSession: (session: CaptureSession | null) => void;
  updateSession: (updater: (prev: CaptureSession) => CaptureSession) => void;
  // View
  currentView: AppView;
  setView: (view: AppView) => void;
  // Edit states per photo
  editStates: Map<string, PhotoEditState>;
  setEditState: (photoId: string, state: PhotoEditState) => void;
  // Template
  selectedTemplate: TemplateConfig | null;
  setSelectedTemplate: (t: TemplateConfig | null) => void;
  // Decoration
  decoration: PhotostripDecoration;
  setDecoration: (d: PhotostripDecoration | ((prev: PhotostripDecoration) => PhotostripDecoration)) => void;
  // Toast
  toast: (msg: string, type?: 'info' | 'success' | 'error') => void;
  toasts: ToastItem[];
}

export interface ToastItem {
  id: string;
  message: string;
  type: 'info' | 'success' | 'error';
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(defaultAppSettings);
  const [language, setLanguageState] = useState<SupportedLanguage>('vi');
  const [currentView, setCurrentView] = useState<AppView>('camera');
  const [currentSession, setCurrentSession] = useState<CaptureSession | null>(null);
  const [editStates, setEditStates] = useState<Map<string, PhotoEditState>>(new Map());
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateConfig | null>(null);
  const [decoration, setDecoration] = useState<PhotostripDecoration>(defaultDecoration);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Load settings on mount
  useEffect(() => {
    loadSettings().then((s) => {
      setSettings(s);
      if (s.language === 'vi' || s.language === 'en') {
        setLanguageState(s.language);
      }
      const resolved =
        s.theme === 'system'
          ? window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
          : s.theme;
      setTheme(resolved);
    });
  }, []);

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const updateSettings = useCallback((partial: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      saveSettings(next).catch(console.error);
      return next;
    });
  }, []);

  const setLanguage = useCallback((lang: SupportedLanguage) => {
    setLanguageState(lang);
    updateSettings({ language: lang });
  }, [updateSettings]);

  const t = useCallback((key: string, params?: Record<string, string | number>) => {
    return translate(language, key, params);
  }, [language]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  const setView = useCallback((view: AppView) => {
    setCurrentView(view);
  }, []);

  const updateSession = useCallback((updater: (prev: CaptureSession) => CaptureSession) => {
    setCurrentSession((prev) => (prev ? updater(prev) : prev));
  }, []);

  const setEditState = useCallback((photoId: string, state: PhotoEditState) => {
    setEditStates((prev) => {
      const next = new Map(prev);
      next.set(photoId, state);
      return next;
    });
  }, []);

  const toast = useCallback((msg: string, type: 'info' | 'success' | 'error' = 'info') => {
    const id = Math.random().toString(36).slice(2);
    const item: ToastItem = { id, message: msg, type };
    setToasts((prev) => [...prev, item]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  return (
    <AppContext.Provider
      value={{
        settings,
        updateSettings,
        language,
        setLanguage,
        t,
        theme,
        toggleTheme,
        currentSession,
        setCurrentSession,
        updateSession,
        currentView,
        setView,
        editStates,
        setEditState,
        selectedTemplate,
        setSelectedTemplate,
        decoration,
        setDecoration,
        toast,
        toasts,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
}
