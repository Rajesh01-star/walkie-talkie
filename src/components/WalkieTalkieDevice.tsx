import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Volume2, VolumeX, Lock, Unlock, AlertCircle, Users } from 'lucide-react';
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
  const [isRecording, setIsRecording] = useState(false);
  const [isReceiving, setIsReceiving] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [userCount, setUserCount] = useState(1);
  const [statusText, setStatusText] = useState('Connecting...');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const ws = useRef<WebSocket | null>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioPlayer = useRef<HTMLAudioElement | null>(null);
  const mediaSource = useRef<MediaSource | null>(null);
  const sourceBuffer = useRef<SourceBuffer | null>(null);
  const audioQueue = useRef<ArrayBuffer[]>([]);
  const reconnectTimer = useRef<NodeJS.Timeout | null>(null);

  // Determine WebSocket backend URL
  const getWsUrl = useCallback(() => {
    if (import.meta.env.VITE_BACKEND_URL) {
      const baseUrl = import.meta.env.VITE_BACKEND_URL.replace(/^http/, 'ws');
      return `${baseUrl}/ws/${channelKey}`;
    }
    if (typeof window !== 'undefined') {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      return `${protocol}//${host}/ws/${channelKey}`;
    }
    return `ws://localhost:4000/ws/${channelKey}`;
  }, [channelKey]);

  // Audio setup using MediaSource
  const setupMediaSource = useCallback(() => {
    if (!audioPlayer.current) return;
    try {
      const ms = new MediaSource();
      mediaSource.current = ms;
      audioPlayer.current.src = URL.createObjectURL(ms);

      ms.addEventListener('sourceopen', () => {
        try {
          const mimeType = 'audio/webm; codecs=opus';
          if (!MediaSource.isTypeSupported(mimeType)) return;
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

  // Connect to Channel WebSocket
  const connect = useCallback(() => {
    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);

    setStatusText('Connecting...');
    setErrorMsg(null);

    const wsUrl = getWsUrl();
    try {
      const socket = new WebSocket(wsUrl);
      socket.binaryType = 'arraybuffer';
      ws.current = socket;

      socket.onopen = () => {
        setIsConnected(true);
        setStatusText('Live');
        soundFx.playStaticBurst(0.04, 0, 0.02);
      };

      socket.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
          setIsReceiving(true);
          if (sourceBuffer.current) {
            if (sourceBuffer.current.updating || audioQueue.current.length > 0) {
              audioQueue.current.push(event.data);
            } else {
              try {
                sourceBuffer.current.appendBuffer(event.data);
              } catch (e) {
                setupMediaSource();
              }
            }
          }
          if (audioPlayer.current?.paused) {
            audioPlayer.current.play().catch(() => {});
          }
        } else {
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
        setStatusText('Disconnected');
        if (!e.wasClean) {
          reconnectTimer.current = setTimeout(() => {
            connect();
          }, 3000);
        }
      };

      socket.onerror = () => {
        setIsConnected(false);
        setStatusText('Error');
      };
    } catch (err) {
      setIsConnected(false);
      setStatusText('Offline');
    }
  }, [getWsUrl, setupMediaSource]);

  useEffect(() => {
    if (!audioPlayer.current) {
      const audio = new Audio();
      audio.onended = () => setIsReceiving(false);
      audioPlayer.current = audio;
      setupMediaSource();
    }
    connect();

    return () => {
      if (ws.current) ws.current.close();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, [channelKey, connect, setupMediaSource]);

  useEffect(() => {
    if (isReceiving) {
      const timer = setTimeout(() => setIsReceiving(false), 800);
      return () => clearTimeout(timer);
    }
  }, [isReceiving]);

  const startTransmitting = async () => {
    if (!isConnected || isRecording) return;
    setErrorMsg(null);

    if (audioPlayer.current) {
      audioPlayer.current.play().then(() => audioPlayer.current?.pause()).catch(() => {});
    }

    try {
      soundFx.playPttStart();
      if (navigator.vibrate) navigator.vibrate(20);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const mimeType = 'audio/webm; codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        setErrorMsg('Microphone format not supported on this browser.');
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

      recorder.start(100);
      setIsRecording(true);
      setStatusText('Talking...');
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMsg('Microphone blocked. Allow microphone permissions in browser (requires HTTPS on mobile).');
        setStatusText('Mic Denied');
      } else {
        setErrorMsg('Unable to access microphone.');
        setStatusText('Mic Error');
      }
    }
  };

  const stopTransmitting = () => {
    if (mediaRecorder.current && mediaRecorder.current.state === 'recording') {
      mediaRecorder.current.stop();
      setIsRecording(false);
      setStatusText(isConnected ? 'Live' : 'Disconnected');
      soundFx.playRogerBeep();
      if (navigator.vibrate) navigator.vibrate([10, 30]);
    }
  };

  const toggleLock = () => {
    if (isLocked) {
      setIsLocked(false);
      stopTransmitting();
    } else {
      setIsLocked(true);
      startTransmitting();
    }
  };

  // Spacebar hotkey
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
    <div className="relative w-full max-w-[340px] bg-[#0c0c0e] border border-white/10 rounded-[2.5rem] p-6 flex flex-col gap-6 shadow-[0_30px_90px_rgba(0,0,0,0.8)] overflow-hidden">
      {/* Subtle top light sheen */}
      <div className="absolute top-0 left-0 right-0 h-28 bg-gradient-to-b from-white/[0.04] to-transparent pointer-events-none" />

      {/* Header bar */}
      <div className="flex items-center justify-between z-10 px-1">
        {/* Status Chip */}
        <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/10">
          <div
            className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.8)] animate-pulse' : 'bg-red-500'
            }`}
          />
          <span className="text-[11px] uppercase tracking-wider text-white/70 font-medium">
            ((•)) {statusText}
          </span>
        </div>

        {/* User count & Audio SFX toggle */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/5 rounded-full border border-white/10 text-white/60 text-xs">
            <Users className="w-3 h-3 text-white/40" />
            <span className="font-semibold text-white/90">{userCount}</span>
          </div>

          <button
            onClick={() => {
              const next = !soundEnabled;
              setSoundEnabled(next);
              soundFx.enabled = next;
            }}
            className="p-1.5 rounded-full bg-white/5 border border-white/10 text-white/40 hover:text-white/80 transition-colors"
            title={soundEnabled ? 'Mute sound effects' : 'Unmute sound effects'}
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5 text-red-400" />}
          </button>
        </div>
      </div>

      {/* Frequency Display */}
      <div className="flex flex-col items-center justify-center py-2 z-10 select-none">
        <div className="text-[4.75rem] font-black tracking-tight text-white leading-none tabular-nums flex items-baseline">
          {frequency}
          <span className="text-xs font-semibold text-white/30 tracking-widest ml-1.5 self-center">
            MHz
          </span>
        </div>

        {/* Minimalist Audio Wave */}
        <div className="w-full mt-3">
          <AudioVisualizer
            isRecording={isRecording}
            isReceiving={isReceiving}
            isConnected={isConnected}
          />
        </div>
      </div>

      {/* Error alert */}
      {errorMsg && (
        <div className="bg-red-950/60 border border-red-500/30 rounded-xl p-3 text-red-200 text-xs flex items-start gap-2 z-10">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Push-To-Talk Button */}
      <div className="flex flex-col items-center justify-center gap-4 z-10">
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
          className={`w-28 h-28 rounded-full flex flex-col items-center justify-center transition-all duration-200 border-4 select-none touch-none shadow-2xl active:scale-95 ${
            !isConnected
              ? 'opacity-25 pointer-events-none border-white/5 bg-white/5'
              : isRecording
              ? 'bg-sky-400 border-sky-300 scale-105 shadow-[0_0_35px_rgba(56,189,248,0.5)] text-zinc-950'
              : 'bg-white/5 border-white/10 hover:border-white/25 hover:bg-white/10 text-white'
          }`}
        >
          <Mic className={`w-9 h-9 transition-transform duration-150 ${isRecording ? 'scale-110' : ''}`} />
        </button>

        <p className="text-[10px] uppercase tracking-[0.25em] font-semibold text-white/40">
          {!isConnected ? 'Offline' : isRecording ? 'Transmitting' : 'Hold to Talk'}
        </p>
      </div>

      {/* Footer Controls: Lock & Info */}
      <div className="flex items-center justify-between pt-4 border-t border-white/5 z-10 text-[11px] text-white/40">
        <button
          onClick={toggleLock}
          disabled={!isConnected}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs transition-colors ${
            isLocked
              ? 'bg-sky-500/20 border-sky-400 text-sky-300'
              : 'bg-white/5 border-white/10 text-white/50 hover:text-white/80'
          }`}
        >
          {isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
          <span>{isLocked ? 'Locked' : 'Hands-free'}</span>
        </button>

        <span className="text-[10px] text-white/30 tracking-wider">
          {isConnected ? '42ms Latency' : 'Standby'}
        </span>
      </div>
    </div>
  );
};
