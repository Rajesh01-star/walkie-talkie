import React, { useState, useEffect } from 'react';
import { WalkieTalkieDevice } from './components/WalkieTalkieDevice';
import { ChannelBar, PRESET_CHANNELS } from './components/ChannelBar';
import { Radio, ShieldAlert, Sparkles, HelpCircle } from 'lucide-react';

export default function App() {
  const [channelKey, setChannelKey] = useState('32-48');
  const [frequency, setFrequency] = useState('32.48');
  const [showGuide, setShowGuide] = useState(false);

  // Sync with URL query parameter ?ch=
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const chParam = params.get('ch');
    if (chParam) {
      const found = PRESET_CHANNELS.find((p) => p.id === chParam);
      if (found) {
        setChannelKey(found.id);
        setFrequency(found.freq);
      } else {
        setChannelKey(chParam);
        setFrequency(chParam.toUpperCase().slice(0, 5));
      }
    }
  }, []);

  const handleSelectChannel = (id: string, freq: string) => {
    setChannelKey(id);
    setFrequency(freq);
    const url = new URL(window.location.href);
    url.searchParams.set('ch', id);
    window.history.replaceState({}, '', url.toString());
  };

  return (
    <div className="min-h-screen bg-tactical-grid flex flex-col items-center justify-between p-4 md:p-8">
      {/* Top Header */}
      <header className="w-full max-w-lg flex items-center justify-between py-2">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 shadow-[0_0_15px_rgba(0,240,255,0.2)]">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base md:text-lg font-black tracking-wider text-white font-display flex items-center gap-2">
              WALKIE TALKIE <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-400/30">PRO</span>
            </h1>
            <p className="text-[11px] font-mono text-zinc-400">Zero-latency Opus radio voice chat</p>
          </div>
        </div>

        <button
          onClick={() => setShowGuide(!showGuide)}
          className="text-xs font-mono text-zinc-400 hover:text-cyan-400 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 transition-colors"
        >
          <HelpCircle className="w-4 h-4" />
          <span className="hidden sm:inline">Guide</span>
        </button>
      </header>

      {/* Quick Guide Drawer Modal */}
      {showGuide && (
        <div className="w-full max-w-lg bg-zinc-900/95 border border-zinc-800 rounded-2xl p-5 mb-4 shadow-2xl backdrop-blur-md">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <h2 className="text-sm font-bold font-mono text-cyan-400 flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> Operational Manual
            </h2>
            <button
              onClick={() => setShowGuide(false)}
              className="text-xs font-mono text-zinc-500 hover:text-white"
            >
              ✕ Close
            </button>
          </div>
          <div className="mt-3 space-y-2.5 text-xs text-zinc-300 font-mono">
            <p>🎙️ <strong>Push-To-Talk:</strong> Hold down the circular PTT button or press <kbd className="bg-zinc-800 px-1 py-0.5 rounded text-white">Spacebar</kbd> on your keyboard to speak.</p>
            <p>🔒 <strong>Hands-Free Lock:</strong> Click "Hands-Free" to keep your mic open continuously.</p>
            <p>📻 <strong>Channels:</strong> Select Alpha, Bravo, Charlie, Delta, or create a private custom room code.</p>
            <p>👥 <strong>Invite Friends:</strong> Click "Share Channel Link" and send the URL to a friend to talk instantly in real-time.</p>
            <p>📱 <strong>Mobile Note:</strong> Requires HTTPS on mobile browsers to enable microphone permissions.</p>
          </div>
        </div>
      )}

      {/* Main Center Stage */}
      <main className="w-full flex flex-col items-center gap-6 my-auto py-4">
        {/* Channel Presets Selector */}
        <ChannelBar
          currentChannel={channelKey}
          currentFreq={frequency}
          onSelectChannel={handleSelectChannel}
        />

        {/* Handheld Walkie Talkie Unit */}
        <WalkieTalkieDevice
          channelKey={channelKey}
          frequency={frequency}
        />
      </main>

      {/* Footer Specs & Attribution */}
      <footer className="w-full max-w-lg flex flex-col sm:flex-row items-center justify-between py-4 text-[11px] font-mono text-zinc-500 border-t border-zinc-800/60 mt-4 gap-2">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400/80" />
          <span>WebSocket Direct Pipe</span>
          <span>•</span>
          <span>Opus 48kHz</span>
        </div>
        <div className="text-zinc-500">
          Ready for Render / Vercel
        </div>
      </footer>
    </div>
  );
}
