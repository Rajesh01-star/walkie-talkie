import React, { useState, useEffect } from 'react';
import { WalkieTalkieDevice } from './components/WalkieTalkieDevice';
import { ChannelBar, PRESET_CHANNELS } from './components/ChannelBar';
import { Radio } from 'lucide-react';

export default function App() {
  const [channelKey, setChannelKey] = useState('32-48');
  const [frequency, setFrequency] = useState('32.48');

  // Sync with URL query param ?ch=
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
    <div className="min-h-screen bg-[#070709] text-zinc-100 flex flex-col items-center justify-between p-4 md:p-8">
      {/* Subtle Minimal Header */}
      <header className="w-full max-w-sm flex items-center justify-between py-2">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-sky-400" />
          <span className="text-sm font-semibold tracking-wide text-zinc-200">Walkie Talkie</span>
        </div>
        <span className="text-[11px] text-zinc-500 font-mono">
          Press <kbd className="bg-zinc-800 px-1 py-0.5 rounded text-zinc-300">Space</kbd> to talk
        </span>
      </header>

      {/* Main Center Stage */}
      <main className="w-full flex flex-col items-center gap-6 my-auto py-6">
        <ChannelBar
          currentChannel={channelKey}
          currentFreq={frequency}
          onSelectChannel={handleSelectChannel}
        />

        <WalkieTalkieDevice
          channelKey={channelKey}
          frequency={frequency}
        />
      </main>

      {/* Minimal Footer */}
      <footer className="w-full max-w-sm flex items-center justify-between py-2 text-[11px] text-zinc-600">
        <span>Opus 48kHz Direct WebSocket</span>
        <span>Low-latency</span>
      </footer>
    </div>
  );
}
