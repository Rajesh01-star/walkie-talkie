# 🎙️ Standalone Walkie-Talkie Web App

A standalone, ultra low-latency push-to-talk Walkie-Talkie web application engineered with **React, Vite, TypeScript, Tailwind CSS, WebSockets, and Opus audio streaming**.

Designed to be hosted as a **single all-in-one service on Render** (or split across Render + Vercel), providing automatic SSL (`https://` & `wss://`) so mobile devices (iOS Safari, Android Chrome) can easily grant microphone permissions.

---

## ⚡ Features

- **Push-To-Talk (PTT):**
  - **Desktop:** Click & hold the central PTT button, or hold <kbd>Spacebar</kbd>.
  - **Mobile:** Touch & hold, or use one-tap transmit.
  - **Hands-Free Lock:** Toggle continuous transmission mode.
- **Dynamic Audio Visualizer:** Real-time animated waveform feedback for transmission, incoming audio, and standby.
- **Synthesized Tactical SFX:** Realistic walkie-talkie squelch, mic click, roger beep, and frequency dial sounds synthesized directly using the Web Audio API (no external MP3 downloads required).
- **Multi-Channel & Custom Frequencies:**
  - Presets: Alpha (32.48 MHz), Bravo (44.10 MHz), Charlie (88.50 MHz), Delta (107.90 MHz).
  - Custom room codes (e.g., `squad-99`).
- **Instant Invite Links:** One-click copy of shareable links (e.g., `?ch=squad-99`) to join the same frequency immediately.
- **Live Channel Metadata:** Real-time count of active radios tuned into each frequency.
- **Keep-Alive Heartbeat:** Built-in WebSocket ping/pong protocol prevents cloud proxy timeouts on free tier hosting.

---

## 🛠️ Architecture

```
┌──────────────────────────────────────────────┐
│  Client (Vite + React + Tailwind + Web Audio)│
│  - MediaRecorder (audio/webm; codecs=opus)   │
│  - MediaSource & AudioContext playback       │
└──────────────────────▲───────────────────────┘
                       │ WebSocket (Binary Opus Chunks)
┌──────────────────────▼───────────────────────┐
│  Server (Express + 'ws' WebSocket Server)    │
│  - Port 4000 (Local) / $PORT (Render)        │
│  - Serves compiled static frontend ('dist')  │
│  - Isolates & broadcasts audio per channel   │
└──────────────────────────────────────────────┘
```

---

## 🚀 Quick Start (Local Development)

### 1. Install dependencies
```bash
npm install
```

### 2. Run in development mode
```bash
npm run dev
```
This runs both the WebSocket server (`localhost:4000`) and the Vite client (`localhost:5173`) concurrently with hot-reloading and WebSocket proxying.

### 3. Build & test production server locally
```bash
npm run build
npm start
```
Open [http://localhost:4000](http://localhost:4000) to test the production bundle.

---

## 🌐 Deploy to Render (Recommended - Free Tier)

Render is the optimal platform because it supports persistent WebSocket connections with automatic HTTPS/WSS and free SSL certificates (which mobile browsers require for microphone access).

### Option A: 1-Click Blueprint (Easiest)
1. Push this repository to your GitHub account (e.g. `walkie-talkie`).
2. Go to your [Render Dashboard](https://dashboard.render.com).
3. Click **New +** > **Blueprint**.
4. Connect your `walkie-talkie` repository.
5. Render reads `render.yaml` and deploys both the backend and frontend automatically!

### Option B: Manual Web Service
1. In the [Render Dashboard](https://dashboard.render.com), click **New +** > **Web Service**.
2. Connect your repository.
3. Configure the following settings:
   - **Environment:** `Node`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Plan:** `Free`
4. Click **Deploy Web Service**.
5. Once deployed, Render gives you a public HTTPS URL (e.g., `https://walkie-talkie-xxx.onrender.com`).
6. Open this URL on your phone or computer, share the link, and start talking!

---

## ⚡ Alternative: Deploying to Vercel

If you prefer hosting the frontend on Vercel:
1. Deploy the backend to Render (Web Service running `node server.js`).
2. Deploy the frontend repository to Vercel.
3. In Vercel Project Settings > **Environment Variables**, add:
   ```
   VITE_BACKEND_URL=https://your-backend-app.onrender.com
   ```
4. Deploy! The frontend will connect its WebSockets directly to your Render backend.
