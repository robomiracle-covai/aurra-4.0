const DEV_SETTINGS_KEY = 'aurra_dev_settings';

const DEFAULT_DEV_SETTINGS = {
  singleTapAdmin: false,     // When true: 1 tap on heading opens Admin; when false: 4 taps required
  bypassAdminPin: false,     // When true: Bypasses 4-digit PIN modal and opens Admin directly
  showFpsBadge: true,        // Toggle visible FPS telemetry pill
  hardwareMockMode: false,   // Allow testing without physical ESP32
};

export const devSettingsService = {
  getSettings() {
    try {
      const stored = localStorage.getItem(DEV_SETTINGS_KEY);
      if (stored) {
        return { ...DEFAULT_DEV_SETTINGS, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.error('Failed to load dev settings', e);
    }
    return { ...DEFAULT_DEV_SETTINGS };
  },

  saveSettings(newSettings) {
    try {
      const current = this.getSettings();
      const merged = { ...current, ...newSettings };
      localStorage.setItem(DEV_SETTINGS_KEY, JSON.stringify(merged));
      // Dispatch custom event for instant cross-component updates
      window.dispatchEvent(new CustomEvent('aurra_dev_settings_changed', { detail: merged }));
      return merged;
    } catch (e) {
      console.error('Failed to save dev settings', e);
      return DEFAULT_DEV_SETTINGS;
    }
  },

  isSingleTapEnabled() {
    return this.getSettings().singleTapAdmin === true;
  },

  isPinBypassed() {
    return this.getSettings().bypassAdminPin === true;
  }
};
