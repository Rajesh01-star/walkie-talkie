import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Volume2, VolumeX, Lock, Unlock, Wifi, WifiOff, Users, AlertCircle } from 'lucide-react';
import { soundFx } from '../lib/soundFx';
import { AudioVisualizer } from './AudioVisualizer';

interface WalkieTalkieDeviceProps {
  channelKey: string;
  frequency: string;
}

export const WalkieTalkieDevice: React.FC<WalkieTalkieDeviceProps> = ({
  channelKey,
  frequency,
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [isReceiving, setIsReceiving] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [userCount, setUserCount] = useState(1);
  const [statusText, setStatusText] = useState('CONNECTING...');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [volume, setVolume] = useState(1.0);

  const ws = useRef<WebSocket | null>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioPlayer = useRef<HTMLAudioElement | null>(null);
  const mediaSource = useRef<MediaSource | null>(null);
  const sourceBuffer = useRef<SourceBuffer | null>(null);
  const audioQueue = useRef<ArrayBuffer[]>([]);
  const reconnectTimer = useRef<NodeJS.Timeout | null>(null);

  // Determine WebSocket backend URL
  const getWsUrl = useCallback(() => {
    // 1. Env variable if provided (e.g. deployed frontend pointing to backend)
    if (import.meta.env.VITE_BACKEND_URL) {
      const baseUrl = import.meta.env.VITE_BACKEND_URL.replace(/^http/, 'ws');
      return `${baseUrl}/ws/${channelKey}`;
    }
    // 2. Same-host protocol detection (Render full-stack single service or localhost)
    if (typeof window !== 'undefined') {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      return `${protocol}//${host}/ws/${channelKey}`;
    }
    return `ws://localhost:4000/ws/${channelKey}`;
  }, [channelKey]);

  // Audio stream setup using MediaSource
  const setupMediaSource = useCallback(() => {
    if (!audioPlayer.current) return;
    try {
      const ms = new MediaSource();
      mediaSource.current = ms;
      audioPlayer.current.src = URL.createObjectURL(ms);

      ms.addEventListener('sourceopen', () => {
        try {
          const mimeType = 'audio/webm; codecs=opus';
          if (!MediaSource.isTypeSupported(mimeType)) {
            console.warn(`[Audio] MIME type ${mimeType} not supported by MediaSource.`);
            return;
          }
          const sb = ms.addSourceBuffer(mimeType);
          sourceBuffer.current = sb;

          sb.addEventListener('updateend', () => {
            if (audioQueue.current.length > 0 && !sb.updating) {
              sb.appendBuffer(audioQueue.current.shift()!);
            }
          });
        } catch (err) {
          console.error('[Audio] SourceBuffer init error:', err);
        }
      });
    } catch (e) {
      console.error('[Audio] MediaSource error:', e);
    }
  }, []);

  // Connect WebSocket to Channel
  const connect = useCallback(() => {
    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);

    setIsConnecting(true);
    setStatusText('TUNING IN...');
    setErrorMsg(null);

    const wsUrl = getWsUrl();
    console.log(`[Radio] Connecting to channel "${channelKey}" at ${wsUrl}`);

    try {
      const socket = new WebSocket(wsUrl);
      socket.binaryType = 'arraybuffer';
      ws.current = socket;

      socket.onopen = () => {
        setIsConnected(true);
        setIsConnecting(false);
        setStatusText('STANDBY');
        soundFx.playStaticBurst(0.05, 0, 0.03);
      };

      socket.onmessage = (event) => {
        // Binary incoming Opus Audio chunks
        if (event.data instanceof ArrayBuffer) {
          setIsReceiving(true);
          if (sourceBuffer.current) {
            if (sourceBuffer.current.updating || audioQueue.current.length > 0) {
              audioQueue.current.push(event.data);
            } else {
              try {
                sourceBuffer.current.appendBuffer(event.data);
              } catch (e) {
                console.warn('[Audio] Buffer append fallback reset:', e);
                setupMediaSource();
              }
            }
          }
          if (audioPlayer.current?.paused) {
            audioPlayer.current.play().catch(() => {});
          }
        } else {
          // JSON Metadata (e.g. users count)
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'metadata') {
              setUserCount(data.users || 1);
            }
          } catch (e) {}
        }
      };

      socket.onclose = (e) => {
        setIsConnected(false);
        setIsConnecting(false);
        setStatusText('DISCONNECTED');
        if (!e.wasClean) {
          reconnectTimer.current = setTimeout(() => {
            console.log('[Radio] Attempting auto-reconnect...');
            connect();
          }, 3500);
        }
      };

      socket.onerror = () => {
        setIsConnected(false);
        setIsConnecting(false);
        setStatusText('SIGNAL LOST');
      };
    } catch (err: any) {
      console.error('[Radio] Socket init error:', err);
      setIsConnected(false);
      setIsConnecting(false);
      setStatusText('OFFLINE');
    }
  }, [channelKey, getWsUrl, setupMediaSource]);

  // Initialize Audio Player & Connect on Channel Change
  useEffect(() => {
    if (!audioPlayer.current) {
      const audio = new Audio();
      audio.volume = volume;
      audio.onended = () => setIsReceiving(false);
      audioPlayer.current = audio;
      setupMediaSource();
    }
    connect();

    return () => {
      if (ws.current) {
        ws.current.close();
        ws.current = null;
      }
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, [channelKey, connect, setupMediaSource]);

  // Keep volume synced
  useEffect(() => {
    if (audioPlayer.current) {
      audioPlayer.current.volume = volume;
    }
  }, [volume]);

  // Audio Receiving Timeout Reset (if stream ends without explicit EOF)
  useEffect(() => {
    if (isReceiving) {
      const timer = setTimeout(() => setIsReceiving(false), 800);
      return () => clearTimeout(timer);
    }
  }, [isReceiving]);

  // Start Transmission (Push-to-Talk active)
  const startTransmitting = async () => {
    if (!isConnected || isRecording) return;
    setErrorMsg(null);

    // Warm up audio player for iOS/Safari audio unlocking
    if (audioPlayer.current) {
      audioPlayer.current.play().then(() => audioPlayer.current?.pause()).catch(() => {});
    }

    try {
      soundFx.playPttStart();
      if (navigator.vibrate) navigator.vibrate(25);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const mimeType = 'audio/webm; codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        setErrorMsg('Microphone codec audio/webm not supported on this browser.');
        return;
      }

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorder.current = recorder;

      recorder.ondataavailable = async (e) => {
        if (e.data.size > 0 && ws.current?.readyState === WebSocket.OPEN) {
          const buffer = await e.data.arrayBuffer();
          ws.current.send(buffer);
        }
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start(100); // 100ms slices for ultra-low latency push-to-talk
      setIsRecording(true);
      setStatusText('TRANSMITTING');
    } catch (err: any) {
      console.error('[Mic Error]', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMsg('Microphone blocked. Please allow mic access in your browser settings (HTTPS required on mobile).');
        setStatusText('MIC BLOCKED');
      } else {
        setErrorMsg(`Mic error: ${err.message || 'Unable to access microphone'}`);
        setStatusText('MIC ERROR');
      }
    }
  };

  // Stop Transmission (Push-to-Talk released)
  const stopTransmitting = () => {
    if (mediaRecorder.current && mediaRecorder.current.state === 'recording') {
      mediaRecorder.current.stop();
      setIsRecording(false);
      setStatusText(isConnected ? 'STANDBY' : 'DISCONNECTED');
      soundFx.playRogerBeep();
      if (navigator.vibrate) navigator.vibrate([15, 40]);
    }
  };

  // Toggle Hands-Free Locked Mode
  const toggleLock = () => {
    if (isLocked) {
      setIsLocked(false);
      stopTransmitting();
    } else {
      setIsLocked(true);
      startTransmitting();
    }
  };

  // Keyboard shortcut: Hold Spacebar to Talk (desktop)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        if (!isLocked) startTransmitting();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        if (!isLocked) stopTransmitting();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isConnected, isLocked]);

  return (
    <div className="relative flex flex-col items-center w-full max-w-[360px]">
      {/* Radio Antenna */}
      <div className="w-full flex items-end justify-start pl-8 mb-[-2px] z-0">
        <div className="flex flex-col items-center">
          <div className="w-2.5 h-6 bg-gradient-to-r from-zinc-700 to-zinc-900 rounded-t-full border border-zinc-700" />
          <div className="w-4 h-8 bg-zinc-800 rounded-t-md border-x border-t border-zinc-600 shadow-md" />
        </div>
        {/* Top Control Knobs */}
        <div className="ml-auto mr-8 flex items-center gap-4">
          <button
            onClick={() => {
              const newSound = !soundEnabled;
              setSoundEnabled(newSound);
              soundFx.enabled = newSound;
            }}
            title={soundEnabled ? 'Mute Radio SFX' : 'Enable Radio SFX'}
            className="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-600 flex items-center justify-center text-zinc-400 hover:text-cyan-400 transition-colors shadow"
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5 text-red-400" />}
          </button>
        </div>
      </div>

      {/* Main Handheld Chassis */}
      <div className="relative w-full bg-[#111416] border-2 border-zinc-800 rounded-[2.5rem] p-6 flex flex-col gap-5 shadow-[0_25px_60px_rgba(0,0,0,0.9),inset_0_1px_1px_rgba(255,255,255,0.15)] z-10">
        
        {/* Side Grip Texture Details */}
        <div className="absolute left-[-6px] top-28 bottom-28 w-1.5 flex flex-col justify-between py-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="w-full h-3 bg-zinc-800 rounded-l border-y border-zinc-700" />
          ))}
        </div>
        <div className="absolute right-[-6px] top-28 bottom-28 w-1.5 flex flex-col justify-between py-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="w-full h-3 bg-zinc-800 rounded-r border-y border-zinc-700" />
          ))}
        </div>

        {/* Top Info Bar */}
        <div className="flex items-center justify-between text-xs font-mono text-zinc-400 border-b border-zinc-800/80 pb-3">
          <div className="flex items-center gap-2">
            {isConnected ? (
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <Wifi className="w-3.5 h-3.5" />
                <span className="font-semibold tracking-wider">ONLINE</span>
              </span>
            ) : isConnecting ? (
              <span className="flex items-center gap-1.5 text-amber-400">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="tracking-wider">CONNECTING</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-red-400">
                <WifiOff className="w-3.5 h-3.5" />
                <span className="tracking-wider">OFFLINE</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-zinc-400 flex items-center gap-1 bg-zinc-900/90 px-2 py-0.5 rounded-md border border-zinc-800">
              <Users className="w-3 h-3 text-cyan-400" />
              <span className="font-bold text-white">{userCount}</span> IN CH
            </span>
          </div>
        </div>

        {/* Tactical LCD Display Screen */}
        <div className="relative bg-[#060b0e] border border-cyan-500/20 rounded-2xl p-4 shadow-inner-lcd overflow-hidden flex flex-col gap-3">
          {/* LCD Scanline Overlay */}
          <div className="absolute inset-0 lcd-scanlines pointer-events-none opacity-40" />

          {/* Screen Header */}
          <div className="flex items-center justify-between z-10">
            <span className="text-[10px] font-mono tracking-widest text-cyan-400/80 uppercase font-semibold">
              CH: {channelKey.toUpperCase()}
            </span>
            <span className={`text-[10px] font-mono font-bold tracking-wider px-2 py-0.5 rounded ${
              isRecording
                ? 'bg-amber-500 text-black glow-amber'
                : isReceiving
                ? 'bg-cyan-400 text-black glow-cyan'
                : 'text-zinc-500'
            }`}>
              {statusText}
            </span>
          </div>

          {/* Large Digital Frequency Readout */}
          <div className="flex items-baseline justify-center gap-1 py-1 z-10 select-none">
            <span className="font-display text-5xl font-black text-cyan-400 tracking-tight glow-cyan">
              {frequency}
            </span>
            <span className="text-xs font-mono font-bold text-cyan-500/70 tracking-widest ml-1">
              MHz
            </span>
          </div>

          {/* Active Audio Wave Visualizer */}
          <div className="z-10 w-full">
            <AudioVisualizer
              isRecording={isRecording}
              isReceiving={isReceiving}
              isConnected={isConnected}
            />
          </div>

          {/* LCD Footer Status */}
          <div className="flex items-center justify-between text-[9px] font-mono text-cyan-500/60 z-10 border-t border-cyan-500/10 pt-2">
            <span>OPUS 48kHz</span>
            <span>LATENCY: ~40ms</span>
          </div>
        </div>

        {/* Error Notification Banner */}
        {errorMsg && (
          <div className="bg-red-950/80 border border-red-500/50 rounded-xl p-3 text-red-200 text-xs flex items-start gap-2 transition-all duration-200 animate-fadeIn">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Speaker Mesh Grille Pattern */}
        <div className="grid grid-cols-8 gap-2 py-1 px-4 opacity-40">
          {Array.from({ length: 24 }).map((_, i) => (
            <div key={i} className="w-1.5 h-1.5 rounded-full bg-zinc-700 mx-auto" />
          ))}
        </div>

        {/* Push-To-Talk Action Zone */}
        <div className="flex flex-col items-center gap-4">
          {/* Main Giant PTT Button */}
          <div className="relative">
            {/* Pulsing ring during transmission */}
            {isRecording && (
              <div className="absolute inset-0 -m-3 rounded-full bg-amber-500/25 animate-ping pointer-events-none" />
            )}

            <button
              onPointerDown={(e) => {
                e.preventDefault();
                if (!isLocked) startTransmitting();
              }}
              onPointerUp={(e) => {
                e.preventDefault();
                if (!isLocked) stopTransmitting();
              }}
              onPointerLeave={() => {
                if (!isLocked && isRecording) stopTransmitting();
              }}
              onPointerCancel={() => {
                if (!isLocked && isRecording) stopTransmitting();
              }}
              disabled={!isConnected}
              className={`w-32 h-32 rounded-full border-4 flex flex-col items-center justify-center transition-all duration-150 select-none shadow-[0_10px_30px_rgba(0,0,0,0.8)] touch-none active:scale-95 ${
                !isConnected
                  ? 'bg-zinc-900 border-zinc-800 text-zinc-600 cursor-not-allowed opacity-40'
                  : isRecording
                  ? 'bg-gradient-to-b from-amber-400 to-amber-600 border-amber-300 text-black scale-105 shadow-[0_0_35px_rgba(251,191,36,0.6)]'
                  : 'bg-gradient-to-b from-zinc-800 to-zinc-900 border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white'
              }`}
            >
              <Mic className={`w-10 h-10 ${isRecording ? 'text-black' : 'text-zinc-300'}`} />
              <span className={`text-[11px] font-mono font-bold tracking-widest mt-1 ${isRecording ? 'text-black' : 'text-zinc-400'}`}>
                {isRecording ? 'TALKING' : 'PUSH TO TALK'}
              </span>
            </button>
          </div>

          {/* Quick Controls: Lock Mode & Spacebar Tip */}
          <div className="w-full flex items-center justify-between px-2 pt-2 border-t border-zinc-800/80">
            <button
              onClick={toggleLock}
              disabled={!isConnected}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono transition-colors ${
                isLocked
                  ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
              <span>{isLocked ? 'PTT Locked' : 'Hands-Free'}</span>
            </button>

            <span className="text-[10px] font-mono text-zinc-500">
              Desktop: <kbd className="bg-zinc-800 px-1 py-0.5 rounded text-zinc-400">Spacebar</kbd>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
