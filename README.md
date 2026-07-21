# Instagram Video Controller 🎬⚡

A modern Chrome Extension (Manifest V3) that enhances the Instagram desktop experience by injecting a YouTube/Netflix-style video player interface with custom controls, interactive seek bar, speed selector, Picture-in-Picture, and keyboard shortcuts over Instagram Reels and videos.

---

## ✨ Key Features

### 🎛️ Custom Video Controls Overlay
- **Play / Pause**: Smooth toggle button & instant spacebar responsiveness.
- **Interactive Seek Bar**: Shows current time, total duration, buffer progress, hover time tooltip, and smooth drag seeking.
- **Skip Forward & Backward**: Dedicated 5s and 10s jump buttons (`J`, `L`, `←`, `→`).
- **Frame-by-Frame Stepping**: Step forward or backward 1 frame at a time while paused (`.` and `,`).
- **Volume & Mute Slider**: Smooth volume slider (0–100%) with low/high/mute icons.
- **Playback Speed Selector**: Choose between `0.25x`, `0.5x`, `0.75x`, `1.0x`, `1.25x`, `1.5x`, `1.75x`, and `2.0x`.
- **Picture-in-Picture (PiP)**: Pop out the Reel into a floating desktop window.
- **Loop Toggle**: Enable or disable continuous looping.
- **Fullscreen Mode**: View Reels in clean fullscreen overlay (`F`).
- **Toast Feedback Overlay**: Animated visual popups in the center of the video whenever actions or shortcuts are triggered.

### ⌨️ Keyboard Shortcuts Reference

| Shortcut | Action |
| :--- | :--- |
| **Space** / **K** | Play / Pause video |
| **M** | Mute / Unmute audio |
| **F** | Toggle Fullscreen |
| **L** | Skip Forward 10 Seconds |
| **J** | Skip Backward 10 Seconds |
| **← (Arrow Left)** | Skip Backward 5 Seconds |
| **→ (Arrow Right)** | Skip Forward 5 Seconds |
| **↑ (Arrow Up)** | Increase Volume (+5%) |
| **↓ (Arrow Down)** | Decrease Volume (-5%) |
| **<** or **,** | Decrease Playback Speed / Step Back 1 Frame (when paused) |
| **>** or **.** | Increase Playback Speed / Step Forward 1 Frame (when paused) |

> 🛡️ **Smart Input Guard**: Keyboard shortcuts automatically bypass when typing in Instagram comment boxes, search inputs, or message fields.

---

## 🎨 UI & Aesthetics
- Dark translucent glassmorphic overlay (`backdrop-filter: blur(16px)`).
- Netflix & YouTube minimalistic control layout with smooth animations.
- Smart auto-hide controls after 2.5s of mouse inactivity while video is playing.

---

## 🚀 How to Install in Google Chrome ("Load unpacked")

1. Open **Google Chrome**.
2. Navigate to `chrome://extensions/` in your browser address bar.
3. Enable **Developer mode** using the toggle in the top-right corner.
4. Click the **Load unpacked** button in the top-left corner.
5. Select this folder directory:
   ```
   c:\Users\oscar\Desktop\videoControler
   ```
6. Open [Instagram Reels](https://www.instagram.com/reels/) in your browser.
7. Enjoy the YouTube-style controls overlay on any Instagram Reel or video!

---

## 🛠️ Project Structure

```
c:\Users\oscar\Desktop\videoControler\
├── manifest.json   # Manifest V3 extension configuration
├── content.js      # MutationObserver DOM & SPA navigation handler
├── player.js       # Video controller logic, event handlers & shortcuts
├── styles.css      # Dark glassmorphism overlay styles & animations
├── popup.html      # Extension action popup interface
├── popup.js        # Extension popup preferences sync
└── README.md       # Project documentation & usage guide
```
