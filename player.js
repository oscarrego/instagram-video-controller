/**
 * Instagram Reel Player Pro - Custom Video Player Controller
 * Manages custom controls overlay, seekbar, volume, speed, shortcuts, and PiP for Instagram Reels.
 * Supports React re-rendering, dynamic video element swaps, and capture-phase event handling.
 */

class InstagramVideoPlayer {
  constructor(videoElement, options = {}, logger = console) {
    this.video = videoElement;
    this.options = Object.assign({
      autoHideDelay: 2500,
      defaultSpeed: 1.0,
      defaultVolume: 1.0,
      enabled: true,
      debug: false
    }, options);

    this.logger = logger;
    this.wrapper = null;
    this.container = null;
    this.controlsBar = null;
    this.toastEl = null;

    // Control Elements
    this.playBtn = null;
    this.volumeBtn = null;
    this.volumeSlider = null;
    this.timeDisplay = null;
    this.seekbarWrapper = null;
    this.seekbarFill = null;
    this.seekbarBuffer = null;
    this.seekbarThumb = null;
    this.seekbarTooltip = null;
    this.speedBtn = null;
    this.speedMenu = null;
    this.speedText = null;
    this.loopBtn = null;
    this.pipBtn = null;
    this.fullscreenBtn = null;

    // State Flags
    this.isDraggingSeekbar = false;
    this.autoHideTimer = null;
    this.speedMenuOpen = false;

    // Bound listeners for clean cleanup
    this.boundKeyHandler = this.handleKeyDown.bind(this);
    this.boundMouseMoveHandler = this.handleMouseMove.bind(this);
    this.boundMouseLeaveHandler = this.handleMouseLeave.bind(this);
    this.boundVideoPlay = () => this.updatePlayState();
    this.boundVideoPause = () => this.updatePlayState();
    this.boundVideoTimeUpdate = () => this.onTimeUpdate();
    this.boundVideoProgress = () => this.onProgress();
    this.boundVideoVolumeChange = () => this.updateVolumeState();
    this.boundVideoRateChange = () => this.updateSpeedState();
    this.boundVideoEnded = () => this.updatePlayState();
    this.boundVideoLoadedMetadata = () => this.onMetadataLoaded();

    this.init();
  }

  /**
   * Initializes the video player overlay and events
   */
  init() {
    if (!this.video || this.video.dataset.irpInitialized === "true") return;
    this.video.dataset.irpInitialized = "true";

    this.log("Initializing player for visible video:", this.video);

    // Locate top Reel card container for proper stacking
    this.setupWrapper();

    // Build the custom overlay DOM
    this.buildUI();

    // Attach video native events
    this.bindVideoEvents();

    // Attach control UI click & drag listeners with CAPTURE phase event handling
    this.bindControlEvents();

    // Attach global keyboard shortcuts
    window.addEventListener("keydown", this.boundKeyHandler, true);

    // Apply initial default speed if set
    if (this.options.defaultSpeed && this.options.defaultSpeed !== 1.0) {
      this.setPlaybackSpeed(this.options.defaultSpeed);
    }

    // Initial sync
    this.updatePlayState();
    this.updateVolumeState();
    this.updateTimeDisplay();
    this.showControls();
    this.scheduleAutoHide();
  }

  /**
   * Identifies top Reel container card for overlay mounting
   */
  setupWrapper() {
    if (!this.video || !this.video.parentElement) return;

    // Target closest Reel article or card container
    let candidate = this.video.closest('article') || 
                    (this.video.closest('div[role="button"]') && this.video.closest('div[role="button"]').parentElement) || 
                    this.video.parentElement;

    this.wrapper = candidate;
    const style = window.getComputedStyle(this.wrapper);
    if (style.position === 'static') {
      this.wrapper.style.setProperty('position', 'relative', 'important');
    }
  }

  /**
   * Guarantees overlay container is mounted in DOM (restores if React wiped it during re-render)
   */
  ensureMounted() {
    if (!this.container || !this.wrapper) return;

    if (!document.body.contains(this.container) && document.body.contains(this.wrapper)) {
      this.log("Re-attaching overlay container wiped by React re-render.");
      this.wrapper.appendChild(this.container);
    }
  }

  /**
   * Constructs the HTML structure for the overlay and controls bar
   */
  buildUI() {
    // Create Main Container Overlay
    this.container = document.createElement("div");
    this.container.className = "irp-container";

    // Create Toast Overlay element
    this.toastEl = document.createElement("div");
    this.toastEl.className = "irp-toast";
    this.toastEl.innerHTML = `<span class="irp-toast-icon"></span><span class="irp-toast-text"></span>`;
    this.container.appendChild(this.toastEl);

    // Create Bottom Controls Bar
    this.controlsBar = document.createElement("div");
    this.controlsBar.className = "irp-controls-bar";

    // Seekbar Section
    const seekbarHTML = `
      <div class="irp-seekbar-wrapper" id="irp-seekbar">
        <div class="irp-seekbar-track">
          <div class="irp-seekbar-buffer" id="irp-buffer"></div>
          <div class="irp-seekbar-fill" id="irp-fill"></div>
          <div class="irp-seekbar-thumb" id="irp-thumb"></div>
        </div>
        <div class="irp-seekbar-tooltip" id="irp-tooltip">0:00</div>
      </div>
    `;

    // Controls Buttons Row
    const buttonsHTML = `
      <div class="irp-buttons-row">
        <div class="irp-left-controls">
          <button class="irp-btn" id="irp-play" data-tooltip="Play (Space / K)">
            ${this.getSvgIcon('play')}
          </button>
          
          <button class="irp-btn" id="irp-rewind-10" data-tooltip="Rewind 10s (J)">
            ${this.getSvgIcon('rewind10')}
          </button>
          
          <button class="irp-btn" id="irp-rewind-5" data-tooltip="Rewind 5s (←)">
            ${this.getSvgIcon('rewind5')}
          </button>

          <button class="irp-btn" id="irp-forward-5" data-tooltip="Forward 5s (→)">
            ${this.getSvgIcon('forward5')}
          </button>

          <button class="irp-btn" id="irp-forward-10" data-tooltip="Forward 10s (L)">
            ${this.getSvgIcon('forward10')}
          </button>

          <div class="irp-volume-container">
            <button class="irp-btn" id="irp-volume" data-tooltip="Mute (M)">
              ${this.getSvgIcon('volumeHigh')}
            </button>
            <div class="irp-volume-slider-wrapper">
              <input type="range" class="irp-volume-slider" id="irp-volume-slider" min="0" max="1" step="0.05" value="${this.video.volume}">
            </div>
          </div>

          <span class="irp-time-display" id="irp-time">0:00 / 0:00</span>
        </div>

        <div class="irp-right-controls">
          <button class="irp-btn" id="irp-frame-back" data-tooltip="Step Back 1 Frame (,)">
            ${this.getSvgIcon('frameBack')}
          </button>
          
          <button class="irp-btn" id="irp-frame-next" data-tooltip="Step Forward 1 Frame (.)">
            ${this.getSvgIcon('frameNext')}
          </button>

          <div class="irp-speed-container">
            <button class="irp-btn" id="irp-speed" data-tooltip="Speed (< / >)">
              <span class="irp-speed-badge" id="irp-speed-text">1.0x</span>
            </button>
            <div class="irp-speed-menu" id="irp-speed-menu">
              <button class="irp-speed-option" data-speed="0.25">0.25x</button>
              <button class="irp-speed-option" data-speed="0.5">0.5x</button>
              <button class="irp-speed-option" data-speed="0.75">0.75x</button>
              <button class="irp-speed-option irp-selected" data-speed="1.0">1.0x (Normal)</button>
              <button class="irp-speed-option" data-speed="1.25">1.25x</button>
              <button class="irp-speed-option" data-speed="1.5">1.5x</button>
              <button class="irp-speed-option" data-speed="1.75">1.75x</button>
              <button class="irp-speed-option" data-speed="2.0">2.0x</button>
            </div>
          </div>

          <button class="irp-btn" id="irp-loop" data-tooltip="Toggle Loop">
            ${this.getSvgIcon('loop')}
          </button>

          <button class="irp-btn" id="irp-pip" data-tooltip="Picture-in-Picture">
            ${this.getSvgIcon('pip')}
          </button>

          <button class="irp-btn" id="irp-fullscreen" data-tooltip="Fullscreen (F)">
            ${this.getSvgIcon('fullscreen')}
          </button>
        </div>
      </div>
    `;

    this.controlsBar.innerHTML = seekbarHTML + buttonsHTML;
    this.container.appendChild(this.controlsBar);

    // Append Overlay to Wrapper Container as LAST CHILD (top of DOM order inside container)
    this.wrapper.appendChild(this.container);

    // Store Element References
    this.playBtn = this.container.querySelector("#irp-play");
    this.volumeBtn = this.container.querySelector("#irp-volume");
    this.volumeSlider = this.container.querySelector("#irp-volume-slider");
    this.timeDisplay = this.container.querySelector("#irp-time");
    this.seekbarWrapper = this.container.querySelector("#irp-seekbar");
    this.seekbarFill = this.container.querySelector("#irp-fill");
    this.seekbarBuffer = this.container.querySelector("#irp-buffer");
    this.seekbarThumb = this.container.querySelector("#irp-thumb");
    this.seekbarTooltip = this.container.querySelector("#irp-tooltip");
    this.speedBtn = this.container.querySelector("#irp-speed");
    this.speedMenu = this.container.querySelector("#irp-speed-menu");
    this.speedText = this.container.querySelector("#irp-speed-text");
    this.loopBtn = this.container.querySelector("#irp-loop");
    this.pipBtn = this.container.querySelector("#irp-pip");
    this.fullscreenBtn = this.container.querySelector("#irp-fullscreen");
  }

  /**
   * Binds HTML5 `<video>` native events
   */
  bindVideoEvents() {
    this.video.addEventListener("play", this.boundVideoPlay);
    this.video.addEventListener("pause", this.boundVideoPause);
    this.video.addEventListener("timeupdate", this.boundVideoTimeUpdate);
    this.video.addEventListener("progress", this.boundVideoProgress);
    this.video.addEventListener("volumechange", this.boundVideoVolumeChange);
    this.video.addEventListener("ratechange", this.boundVideoRateChange);
    this.video.addEventListener("ended", this.boundVideoEnded);
    this.video.addEventListener("loadedmetadata", this.boundVideoLoadedMetadata);
  }

  /**
   * Binds UI control button clicks and interactions with CAPTURE PHASE interception
   */
  bindControlEvents() {
    // Intercept mouse, pointer, & touch events in CAPTURE PHASE
    // to stop Instagram's React delegation at document root from hijacking clicks
    const stopEvents = [
      "mousedown", "mouseup", "click", "dblclick",
      "pointerdown", "pointerup", "pointermove",
      "touchstart", "touchend", "touchmove", "contextmenu"
    ];

    stopEvents.forEach((eventName) => {
      this.controlsBar.addEventListener(eventName, (e) => {
        e.stopPropagation();
      }, true); // TRUE = CAPTURE PHASE!
    });

    // Play/Pause button
    this.playBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.togglePlayPause();
    });

    // Skip buttons
    this.container.querySelector("#irp-rewind-10").addEventListener("click", (e) => {
      e.stopPropagation();
      this.skipSeconds(-10);
    });
    this.container.querySelector("#irp-rewind-5").addEventListener("click", (e) => {
      e.stopPropagation();
      this.skipSeconds(-5);
    });
    this.container.querySelector("#irp-forward-5").addEventListener("click", (e) => {
      e.stopPropagation();
      this.skipSeconds(5);
    });
    this.container.querySelector("#irp-forward-10").addEventListener("click", (e) => {
      e.stopPropagation();
      this.skipSeconds(10);
    });

    // Frame stepping buttons
    this.container.querySelector("#irp-frame-back").addEventListener("click", (e) => {
      e.stopPropagation();
      this.stepFrame(-1);
    });
    this.container.querySelector("#irp-frame-next").addEventListener("click", (e) => {
      e.stopPropagation();
      this.stepFrame(1);
    });

    // Volume button & slider
    this.volumeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.toggleMute();
    });
    this.volumeSlider.addEventListener("input", (e) => {
      e.stopPropagation();
      this.video.volume = parseFloat(e.target.value);
      this.video.muted = (this.video.volume === 0);
    });

    // Seekbar Click & Drag
    this.seekbarWrapper.addEventListener("mousedown", (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.isDraggingSeekbar = true;
      this.seekbarWrapper.classList.add("irp-dragging");
      this.handleSeekDrag(e);
    });

    window.addEventListener("mousemove", (e) => {
      if (this.isDraggingSeekbar) {
        this.handleSeekDrag(e);
      }
    });

    window.addEventListener("mouseup", (e) => {
      if (this.isDraggingSeekbar) {
        this.isDraggingSeekbar = false;
        this.seekbarWrapper.classList.remove("irp-dragging");
      }
    });

    this.seekbarWrapper.addEventListener("mousemove", (e) => {
      this.updateSeekbarTooltip(e);
    });

    // Playback Speed dropdown menu
    this.speedBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.toggleSpeedMenu();
    });

    this.speedMenu.querySelectorAll(".irp-speed-option").forEach((opt) => {
      opt.addEventListener("click", (e) => {
        e.stopPropagation();
        const speed = parseFloat(opt.dataset.speed);
        this.setPlaybackSpeed(speed);
        this.closeSpeedMenu();
      });
    });

    // Close speed menu when clicking outside
    document.addEventListener("click", (e) => {
      if (this.speedMenuOpen && !this.speedBtn.contains(e.target) && !this.speedMenu.contains(e.target)) {
        this.closeSpeedMenu();
      }
    });

    // Loop button
    this.loopBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.toggleLoop();
    });

    // Picture-in-Picture button
    this.pipBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.togglePiP();
    });

    // Fullscreen button
    this.fullscreenBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.toggleFullscreen();
    });

    // Auto-hide controls listeners on wrapper
    this.wrapper.addEventListener("mousemove", this.boundMouseMoveHandler);
    this.wrapper.addEventListener("mouseleave", this.boundMouseLeaveHandler);
  }

  /**
   * Called when video metadata finishes loading or when src changes
   */
  onMetadataLoaded() {
    this.log("Metadata loaded for video:", this.video.src);
    this.ensureMounted();
    this.updateTimeDisplay();
    this.onProgress();
    this.updatePlayState();
  }

  /**
   * Updates play / pause button state
   */
  updatePlayState() {
    this.ensureMounted();
    if (this.video.paused) {
      this.playBtn.innerHTML = this.getSvgIcon("play");
      this.playBtn.setAttribute("data-tooltip", "Play (Space / K)");
      this.showControls();
    } else {
      this.playBtn.innerHTML = this.getSvgIcon("pause");
      this.playBtn.setAttribute("data-tooltip", "Pause (Space / K)");
      this.scheduleAutoHide();
    }
  }

  /**
   * Play / Pause Toggle with fallback
   */
  togglePlayPause() {
    this.ensureMounted();
    if (this.video.paused) {
      const promise = this.video.play();
      if (promise !== undefined) {
        promise.then(() => {
          this.showToast("Play", this.getSvgIcon("play"));
        }).catch((err) => {
          this.warn("Programmatic play() blocked or intercepted. Attempting overlay fallback trigger.", err);
          const nativeBtn = this.wrapper.querySelector('div[role="button"]') || 
                            (this.wrapper.parentElement && this.wrapper.parentElement.querySelector('div[role="button"]'));
          if (nativeBtn) nativeBtn.click();
        });
      }
    } else {
      this.video.pause();
      this.showToast("Pause", this.getSvgIcon("pause"));
    }
  }

  /**
   * Mute / Unmute Toggle
   */
  toggleMute() {
    this.video.muted = !this.video.muted;
    if (this.video.muted) {
      this.showToast("Muted", this.getSvgIcon("volumeMute"));
    } else {
      this.showToast(`Volume: ${Math.round(this.video.volume * 100)}%`, this.getSvgIcon("volumeHigh"));
    }
  }

  /**
   * Syncs volume button icon and slider position
   */
  updateVolumeState() {
    const isMuted = this.video.muted || this.video.volume === 0;
    this.volumeSlider.value = isMuted ? 0 : this.video.volume;
    
    if (isMuted) {
      this.volumeBtn.innerHTML = this.getSvgIcon("volumeMute");
    } else if (this.video.volume < 0.5) {
      this.volumeBtn.innerHTML = this.getSvgIcon("volumeLow");
    } else {
      this.volumeBtn.innerHTML = this.getSvgIcon("volumeHigh");
    }
  }

  /**
   * Video currentTime update handler
   */
  onTimeUpdate() {
    this.ensureMounted();
    if (!this.video.duration || this.isDraggingSeekbar) return;
    const pct = (this.video.currentTime / this.video.duration) * 100;
    this.seekbarFill.style.width = `${pct}%`;
    this.seekbarThumb.style.left = `${pct}%`;
    this.updateTimeDisplay();
  }

  /**
   * Video progress buffer bar update
   */
  onProgress() {
    if (!this.video.duration || !this.video.buffered.length) return;
    const bufferedEnd = this.video.buffered.end(this.video.buffered.length - 1);
    const pct = (bufferedEnd / this.video.duration) * 100;
    this.seekbarBuffer.style.width = `${pct}%`;
  }

  /**
   * Formats and updates time display (mm:ss / mm:ss)
   */
  updateTimeDisplay() {
    const current = this.formatTime(this.video.currentTime || 0);
    const duration = this.formatTime(this.video.duration || 0);
    this.timeDisplay.textContent = `${current} / ${duration}`;
  }

  /**
   * Handles dragging on seek bar
   */
  handleSeekDrag(e) {
    const rect = this.seekbarWrapper.getBoundingClientRect();
    let offsetX = e.clientX - rect.left;
    offsetX = Math.max(0, Math.min(offsetX, rect.width));
    const pct = offsetX / rect.width;
    
    this.seekbarFill.style.width = `${pct * 100}%`;
    this.seekbarThumb.style.left = `${pct * 100}%`;
    
    if (this.video.duration) {
      this.video.currentTime = pct * this.video.duration;
    }
    this.updateTimeDisplay();
  }

  /**
   * Updates time tooltip when hovering over seekbar
   */
  updateSeekbarTooltip(e) {
    const rect = this.seekbarWrapper.getBoundingClientRect();
    let offsetX = e.clientX - rect.left;
    offsetX = Math.max(0, Math.min(offsetX, rect.width));
    const pct = offsetX / rect.width;
    
    const hoverTime = (this.video.duration || 0) * pct;
    this.seekbarTooltip.textContent = this.formatTime(hoverTime);
    this.seekbarTooltip.style.left = `${offsetX}px`;
  }

  /**
   * Skip forward / backward
   */
  skipSeconds(sec) {
    if (!this.video.duration) return;
    this.video.currentTime = Math.max(0, Math.min(this.video.duration, this.video.currentTime + sec));
    const sign = sec > 0 ? "+" : "";
    this.showToast(`${sign}${sec}s`, sec > 0 ? this.getSvgIcon("forward5") : this.getSvgIcon("rewind5"));
  }

  /**
   * Step frame by frame (assuming standard ~30 FPS frame rate = ~0.0333 seconds)
   */
  stepFrame(direction) {
    if (!this.video.paused) {
      this.video.pause();
    }
    const frameTime = 1 / 30; // 30 fps
    this.video.currentTime = Math.max(0, Math.min(this.video.duration || 0, this.video.currentTime + (direction * frameTime)));
    const frameLabel = direction > 0 ? "Frame +1" : "Frame -1";
    this.showToast(frameLabel, direction > 0 ? this.getSvgIcon("frameNext") : this.getSvgIcon("frameBack"));
  }

  /**
   * Set playback speed
   */
  setPlaybackSpeed(speed) {
    this.video.playbackRate = speed;
    this.updateSpeedState();
    this.showToast(`Speed: ${speed}x`, this.getSvgIcon("speed"));
  }

  /**
   * Sync speed menu badge and selected item
   */
  updateSpeedState() {
    const currentSpeed = this.video.playbackRate;
    this.speedText.textContent = `${currentSpeed}x`;
    
    this.speedMenu.querySelectorAll(".irp-speed-option").forEach((opt) => {
      const optSpeed = parseFloat(opt.dataset.speed);
      if (optSpeed === currentSpeed) {
        opt.classList.add("irp-selected");
      } else {
        opt.classList.remove("irp-selected");
      }
    });
  }

  toggleSpeedMenu() {
    this.speedMenuOpen = !this.speedMenuOpen;
    if (this.speedMenuOpen) {
      this.speedMenu.classList.add("irp-speed-menu-open");
    } else {
      this.speedMenu.classList.remove("irp-speed-menu-open");
    }
  }

  closeSpeedMenu() {
    this.speedMenuOpen = false;
    this.speedMenu.classList.remove("irp-speed-menu-open");
  }

  /**
   * Toggle loop mode
   */
  toggleLoop() {
    this.video.loop = !this.video.loop;
    if (this.video.loop) {
      this.loopBtn.classList.add("irp-active");
      this.showToast("Loop: On", this.getSvgIcon("loop"));
    } else {
      this.loopBtn.classList.remove("irp-active");
      this.showToast("Loop: Off", this.getSvgIcon("loop"));
    }
  }

  /**
   * Toggle Picture-in-Picture (PiP)
   */
  async togglePiP() {
    try {
      if (document.pictureInPictureElement === this.video) {
        await document.exitPictureInPicture();
        this.pipBtn.classList.remove("irp-active");
        this.showToast("PiP Exited", this.getSvgIcon("pip"));
      } else if (document.pictureInPictureEnabled) {
        await this.video.requestPictureInPicture();
        this.pipBtn.classList.add("irp-active");
        this.showToast("Picture-in-Picture", this.getSvgIcon("pip"));
      }
    } catch (err) {
      this.warn("PiP error:", err);
    }
  }

  /**
   * Toggle Fullscreen
   */
  toggleFullscreen() {
    const target = this.wrapper || this.video;
    if (!document.fullscreenElement) {
      if (target.requestFullscreen) {
        target.requestFullscreen();
      } else if (target.webkitRequestFullscreen) {
        target.webkitRequestFullscreen();
      }
      this.showToast("Fullscreen", this.getSvgIcon("fullscreen"));
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  }

  /**
   * Global Keyboard Shortcuts Handler with safety guard for input controls
   */
  handleKeyDown(e) {
    if (this.isInputFocused()) return;

    const key = e.key;

    switch (key) {
      case " ":
      case "k":
      case "K":
        e.preventDefault();
        e.stopPropagation();
        this.togglePlayPause();
        break;

      case "m":
      case "M":
        e.preventDefault();
        e.stopPropagation();
        this.toggleMute();
        break;

      case "f":
      case "F":
        e.preventDefault();
        e.stopPropagation();
        this.toggleFullscreen();
        break;

      case "j":
      case "J":
        e.preventDefault();
        e.stopPropagation();
        this.skipSeconds(-10);
        break;

      case "l":
      case "L":
        e.preventDefault();
        e.stopPropagation();
        this.skipSeconds(10);
        break;

      case "ArrowLeft":
        e.preventDefault();
        e.stopPropagation();
        this.skipSeconds(-5);
        break;

      case "ArrowRight":
        e.preventDefault();
        e.stopPropagation();
        this.skipSeconds(5);
        break;

      case "ArrowUp":
        e.preventDefault();
        e.stopPropagation();
        this.video.volume = Math.min(1, this.video.volume + 0.05);
        this.video.muted = false;
        this.showToast(`Volume: ${Math.round(this.video.volume * 100)}%`, this.getSvgIcon("volumeHigh"));
        break;

      case "ArrowDown":
        e.preventDefault();
        e.stopPropagation();
        this.video.volume = Math.max(0, this.video.volume - 0.05);
        this.showToast(`Volume: ${Math.round(this.video.volume * 100)}%`, this.getSvgIcon("volumeLow"));
        break;

      case "<":
      case ",":
        e.preventDefault();
        e.stopPropagation();
        if (e.shiftKey) {
          this.cycleSpeed(-1);
        } else if (this.video.paused) {
          this.stepFrame(-1);
        } else {
          this.cycleSpeed(-1);
        }
        break;

      case ">":
      case ".":
        e.preventDefault();
        e.stopPropagation();
        if (e.shiftKey) {
          this.cycleSpeed(1);
        } else if (this.video.paused) {
          this.stepFrame(1);
        } else {
          this.cycleSpeed(1);
        }
        break;
    }
  }

  /**
   * Helper to cycle speed up or down among standard steps
   */
  cycleSpeed(delta) {
    const speeds = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];
    const current = this.video.playbackRate;
    let idx = speeds.indexOf(current);
    if (idx === -1) idx = 3; // default 1.0
    
    let nextIdx = idx + delta;
    nextIdx = Math.max(0, Math.min(speeds.length - 1, nextIdx));
    this.setPlaybackSpeed(speeds[nextIdx]);
  }

  /**
   * Checks if user is typing in comments, search box, or any contenteditable element
   */
  isInputFocused() {
    const active = document.activeElement;
    if (!active) return false;
    const tag = active.tagName.toLowerCase();
    return (
      tag === "input" ||
      tag === "textarea" ||
      tag === "select" ||
      active.isContentEditable ||
      active.getAttribute("role") === "textbox"
    );
  }

  /**
   * Mouse movement auto-hide handler
   */
  handleMouseMove() {
    this.showControls();
    this.scheduleAutoHide();
  }

  handleMouseLeave() {
    if (!this.video.paused && !this.speedMenuOpen) {
      this.hideControls();
    }
  }

  showControls() {
    this.ensureMounted();
    if (this.controlsBar) {
      this.controlsBar.classList.remove("irp-hidden");
    }
  }

  hideControls() {
    if (this.controlsBar && !this.speedMenuOpen && !this.isDraggingSeekbar) {
      this.controlsBar.classList.add("irp-hidden");
    }
  }

  scheduleAutoHide() {
    clearTimeout(this.autoHideTimer);
    if (this.video.paused || this.speedMenuOpen || this.isDraggingSeekbar) return;

    this.autoHideTimer = setTimeout(() => {
      this.hideControls();
    }, this.options.autoHideDelay);
  }

  /**
   * Displays center overlay toast feedback
   */
  showToast(text, iconSvg = "") {
    if (!this.toastEl) return;
    const iconSpan = this.toastEl.querySelector(".irp-toast-icon");
    const textSpan = this.toastEl.querySelector(".irp-toast-text");
    
    iconSpan.innerHTML = iconSvg;
    textSpan.textContent = text;
    
    this.toastEl.classList.add("irp-toast-show");
    
    clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      this.toastEl.classList.remove("irp-toast-show");
    }, 1200);
  }

  /**
   * Helper formatting seconds into mm:ss or hh:mm:ss
   */
  formatTime(seconds) {
    if (isNaN(seconds)) return "0:00";
    const sec = Math.floor(seconds % 60);
    const min = Math.floor((seconds / 60) % 60);
    const hrs = Math.floor(seconds / 3600);
    
    const padSec = sec < 10 ? `0${sec}` : `${sec}`;
    if (hrs > 0) {
      const padMin = min < 10 ? `0${min}` : `${min}`;
      return `${hrs}:${padMin}:${padSec}`;
    }
    return `${min}:${padSec}`;
  }

  log(...args) {
    if (this.logger && typeof this.logger.log === 'function') {
      this.logger.log(...args);
    }
  }

  warn(...args) {
    if (this.logger && typeof this.logger.warn === 'function') {
      this.logger.warn(...args);
    }
  }

  /**
   * SVG Icon Registry
   */
  getSvgIcon(name) {
    const icons = {
      play: `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`,
      pause: `<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`,
      rewind10: `<svg viewBox="0 0 24 24"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/><text x="12" y="14.5" font-size="7" font-weight="bold" text-anchor="middle" fill="currentColor">10</text></svg>`,
      rewind5: `<svg viewBox="0 0 24 24"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/><text x="12" y="14.5" font-size="7.5" font-weight="bold" text-anchor="middle" fill="currentColor">5</text></svg>`,
      forward5: `<svg viewBox="0 0 24 24"><path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"/><text x="12" y="14.5" font-size="7.5" font-weight="bold" text-anchor="middle" fill="currentColor">5</text></svg>`,
      forward10: `<svg viewBox="0 0 24 24"><path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"/><text x="12" y="14.5" font-size="7.5" font-weight="bold" text-anchor="middle" fill="currentColor">10</text></svg>`,
      volumeHigh: `<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`,
      volumeLow: `<svg viewBox="0 0 24 24"><path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z"/></svg>`,
      volumeMute: `<svg viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73 4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>`,
      frameBack: `<svg viewBox="0 0 24 24"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z"/><rect x="2" y="6" width="2" height="12"/></svg>`,
      frameNext: `<svg viewBox="0 0 24 24"><path d="M13 6v12l8.5-6L13 6zM12.5 12L4 6v12l8.5-6z"/><rect x="20" y="6" width="2" height="12"/></svg>`,
      speed: `<svg viewBox="0 0 24 24"><path d="M20.38 8.57l-1.23 1.85a8 8 0 0 1-.22 7.58H5.07A8 8 0 0 1 15.58 6.85l1.85-1.23A10 10 0 0 0 3.35 19a2 2 0 0 0 1.72 1h13.85a2 2 0 0 0 1.74-1 10 10 0 0 0-.28-10.43z"/><path d="M10.59 15.41a2 2 0 0 0 2.83 0l5.66-8.49-8.49 5.66a2 2 0 0 0 0 2.83z"/></svg>`,
      loop: `<svg viewBox="0 0 24 24"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0 0 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 0 0 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>`,
      pip: `<svg viewBox="0 0 24 24"><path d="M19 7h-8v6h8V7zm2-4H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14z"/></svg>`,
      fullscreen: `<svg viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>`
    };
    return icons[name] || "";
  }

  /**
   * Destroys and cleans up listeners and injected DOM
   */
  destroy() {
    this.log("Destroying player for video:", this.video);
    window.removeEventListener("keydown", this.boundKeyHandler, true);
    
    if (this.video) {
      this.video.removeEventListener("play", this.boundVideoPlay);
      this.video.removeEventListener("pause", this.boundVideoPause);
      this.video.removeEventListener("timeupdate", this.boundVideoTimeUpdate);
      this.video.removeEventListener("progress", this.boundVideoProgress);
      this.video.removeEventListener("volumechange", this.boundVideoVolumeChange);
      this.video.removeEventListener("ratechange", this.boundVideoRateChange);
      this.video.removeEventListener("ended", this.boundVideoEnded);
      this.video.removeEventListener("loadedmetadata", this.boundVideoLoadedMetadata);
      delete this.video.dataset.irpInitialized;
    }

    if (this.wrapper) {
      this.wrapper.removeEventListener("mousemove", this.boundMouseMoveHandler);
      this.wrapper.removeEventListener("mouseleave", this.boundMouseLeaveHandler);
    }

    if (this.container && this.container.parentElement) {
      this.container.parentElement.removeChild(this.container);
    }
  }
}

// Make InstagramVideoPlayer available globally to content.js
window.InstagramVideoPlayer = InstagramVideoPlayer;
