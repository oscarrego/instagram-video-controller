/**
 * Instagram Reel Player Pro - Content Script
 * Dynamically detects HTML5 <video> elements on Instagram Reels, handles React DOM re-renders,
 * manages MutationObservers, SPA route navigation, and prevents duplicate player overlays.
 */

(function () {
  'use strict';

  // Configurable Debug Logger
  const Logger = {
    enabled: true,
    log(...args) {
      if (this.enabled) {
        console.log("%c[IRP Pro]", "color: #ff007a; font-weight: bold;", ...args);
      }
    },
    warn(...args) {
      if (this.enabled) {
        console.warn("%c[IRP Pro]", "color: #ffaa00; font-weight: bold;", ...args);
      }
    },
    error(...args) {
      if (this.enabled) {
        console.error("%c[IRP Pro]", "color: #ff2222; font-weight: bold;", ...args);
      }
    }
  };

  // Map linking HTML5 <video> elements to their InstagramVideoPlayer instance
  const playerMap = new Map();

  // Extension default settings
  let userSettings = {
    enabled: true,
    defaultSpeed: 1.0,
    defaultVolume: 1.0,
    autoHideDelay: 2500,
    debugLogs: true
  };

  /**
   * Helper checking if a video element is visible and active on screen
   * Filter out hidden background preloaded videos that Instagram creates in cache
   */
  function isVisibleVideo(video) {
    if (!video || !document.body.contains(video)) return false;

    // Check rendered layout dimensions
    const rect = video.getBoundingClientRect();
    if (rect.width < 100 || rect.height < 100) return false;

    // Check inline or computed styles
    const style = window.getComputedStyle(video);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;

    // Ensure element is near or within the viewport (-300px buffer for smooth scroll transitions)
    const inViewport = (rect.bottom > -300 && rect.top < window.innerHeight + 300);
    return inViewport;
  }

  /**
   * Loads saved settings from chrome storage
   */
  function loadSettings() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.get({
        enabled: true,
        defaultSpeed: 1.0,
        defaultVolume: 1.0,
        autoHideDelay: 2500,
        debugLogs: true
      }, (items) => {
        userSettings = items;
        Logger.enabled = !!userSettings.debugLogs;
        Logger.log("Settings loaded:", userSettings);

        if (!userSettings.enabled) {
          destroyAllPlayers();
        } else {
          scanAndAttachVideos();
        }
      });
    }
  }

  /**
   * Listens for settings updates from Popup
   */
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'sync' || namespace === 'local') {
        for (let key in changes) {
          userSettings[key] = changes[key].newValue;
        }

        if (changes.debugLogs !== undefined) {
          Logger.enabled = !!changes.debugLogs.newValue;
        }

        Logger.log("Settings changed:", userSettings);

        if (changes.enabled) {
          if (!changes.enabled.newValue) {
            destroyAllPlayers();
          } else {
            scanAndAttachVideos();
          }
        }
      }
    });
  }

  /**
   * Scans document for HTML5 <video> elements and attaches custom controllers
   */
  function scanAndAttachVideos() {
    if (!userSettings.enabled) return;

    const videos = document.querySelectorAll("video");
    
    videos.forEach((video) => {
      // Filter out hidden, offscreen, or preloaded background video cache tags
      if (!isVisibleVideo(video)) return;

      // Check if player instance already exists for this video
      if (!playerMap.has(video) && video.dataset.irpInitialized !== "true") {
        if (window.InstagramVideoPlayer) {
          try {
            Logger.log("Visible video detected. Instantiating player instance.");
            const playerOptions = Object.assign({}, userSettings, { debug: Logger.enabled });
            const player = new window.InstagramVideoPlayer(video, playerOptions, Logger);
            playerMap.set(video, player);
          } catch (e) {
            Logger.error("Error attaching player to video:", e);
          }
        } else {
          Logger.warn("InstagramVideoPlayer class not found on window object.");
        }
      } else if (playerMap.has(video)) {
        // Ensure overlay container hasn't been wiped by a React re-render
        const player = playerMap.get(video);
        player.ensureMounted();
      }
    });

    // Cleanup player instances for videos that were unmounted from DOM
    playerMap.forEach((player, video) => {
      if (!document.body.contains(video)) {
        Logger.log("Video element unmounted from DOM. Cleaning up player instance.");
        player.destroy();
        playerMap.delete(video);
      }
    });
  }

  /**
   * Destroy all player instances
   */
  function destroyAllPlayers() {
    Logger.log("Destroying all player instances.");
    playerMap.forEach((player) => {
      player.destroy();
    });
    playerMap.clear();
  }

  /**
   * Setup MutationObserver to handle dynamically rendered Reels as user scrolls
   */
  function setupObserver() {
    const observer = new MutationObserver((mutations) => {
      let shouldScan = false;
      for (const mutation of mutations) {
        if (mutation.addedNodes.length || mutation.removedNodes.length) {
          shouldScan = true;
          break;
        }
      }
      if (shouldScan) {
        scanAndAttachVideos();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    Logger.log("MutationObserver initialized.");
  }

  /**
   * Heartbeat scanner to catch videos injected during fast scrolling or React state transitions
   */
  function setupHeartbeat() {
    setInterval(() => {
      if (userSettings.enabled) {
        scanAndAttachVideos();
      }
    }, 1000);
  }

  /**
   * Handle SPA Navigation (Instagram history changes)
   */
  function setupSPANavigationHandler() {
    let lastUrl = location.href;

    const checkUrlChange = () => {
      if (location.href !== lastUrl) {
        Logger.log("SPA Route navigation detected:", location.href);
        lastUrl = location.href;
        setTimeout(() => {
          scanAndAttachVideos();
        }, 400);
      }
    };

    // Override pushState and replaceState
    const originalPushState = history.pushState;
    history.pushState = function () {
      originalPushState.apply(this, arguments);
      checkUrlChange();
    };

    const originalReplaceState = history.replaceState;
    history.replaceState = function () {
      originalReplaceState.apply(this, arguments);
      checkUrlChange();
    };

    window.addEventListener("popstate", checkUrlChange);
  }

  /**
   * Initialization Entry Point
   */
  function init() {
    Logger.log("Instagram Reel Player Pro Content Script initialized.");
    loadSettings();
    setupObserver();
    setupHeartbeat();
    setupSPANavigationHandler();
    
    // Initial scanning passes
    scanAndAttachVideos();
    setTimeout(scanAndAttachVideos, 800);
    setTimeout(scanAndAttachVideos, 2000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
