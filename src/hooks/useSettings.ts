import { useState, useCallback, useEffect } from 'react';
import type { AppSettings } from '@/types';
import { defaultAppSettings } from '@/types';
import { saveSettings, loadSettings } from '@/services/storage.service';

export function useSettings() {
  const [settings, setSettingsState] = useState<AppSettings>(defaultAppSettings);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings().then((s) => {
      setSettingsState(s);
      setLoading(false);
    });
  }, []);

  const updateSettings = useCallback((partial: Partial<AppSettings>) => {
    setSettingsState((prev) => {
      const updated = { ...prev, ...partial };
      saveSettings(updated).catch(console.error);
      return updated;
    });
  }, []);

  const resetSettings = useCallback(() => {
    setSettingsState(defaultAppSettings);
    saveSettings(defaultAppSettings).catch(console.error);
  }, []);

  return { settings, updateSettings, resetSettings, loading };
}
