/**
 * Instagram Reel Player Pro - Popup Settings Handler
 * Handles setting toggles, default playback speed selection, debug logging, and persistent storage.
 */

document.addEventListener("DOMContentLoaded", () => {
  const enabledToggle = document.getElementById("enabled-toggle");
  const defaultSpeedSelect = document.getElementById("default-speed");
  const autoHideToggle = document.getElementById("autohide-toggle");
  const debugToggle = document.getElementById("debug-toggle");

  // Load existing user preferences
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.get({
      enabled: true,
      defaultSpeed: 1.0,
      autoHideDelay: 2500,
      debugLogs: true
    }, (items) => {
      enabledToggle.checked = items.enabled;
      defaultSpeedSelect.value = items.defaultSpeed.toString();
      autoHideToggle.checked = items.autoHideDelay > 0;
      debugToggle.checked = items.debugLogs;
    });
  }

  // Handle Enable / Disable Toggle
  enabledToggle.addEventListener("change", () => {
    const isEnabled = enabledToggle.checked;
    chrome.storage.sync.set({ enabled: isEnabled });
  });

  // Handle Default Speed change
  defaultSpeedSelect.addEventListener("change", () => {
    const speed = parseFloat(defaultSpeedSelect.value);
    chrome.storage.sync.set({ defaultSpeed: speed });
  });

  // Handle Auto-Hide toggle
  autoHideToggle.addEventListener("change", () => {
    const delay = autoHideToggle.checked ? 2500 : 0;
    chrome.storage.sync.set({ autoHideDelay: delay });
  });

  // Handle Debug Logging toggle
  debugToggle.addEventListener("change", () => {
    const debug = debugToggle.checked;
    chrome.storage.sync.set({ debugLogs: debug });
  });
});
