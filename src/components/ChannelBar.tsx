import React, { useState } from 'react';
import { Radio, Hash, Copy, Check } from 'lucide-react';
import { soundFx } from '../lib/soundFx';

export interface ChannelPreset {
  id: string;
  name: string;
  freq: string;
}

export const PRESET_CHANNELS: ChannelPreset[] = [
  { id: '32-48', name: 'ALPHA', freq: '32.48' },
  { id: '44-10', name: 'BRAVO', freq: '44.10' },
  { id: '88-50', name: 'CHARLIE', freq: '88.50' },
  { id: '107-90', name: 'DELTA', freq: '107.90' },
];

interface ChannelBarProps {
  currentChannel: string;
  currentFreq: string;
  onSelectChannel: (channelId: string, freq: string) => void;
}

export const ChannelBar: React.FC<ChannelBarProps> = ({
  currentChannel,
  currentFreq,
  onSelectChannel,
}) => {
  const [customInput, setCustomInput] = useState('');
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleSelect = (id: string, freq: string) => {
    if (id === currentChannel) return;
    soundFx.playTuneClick();
    soundFx.playStaticBurst(0.06, 0.02, 0.04);
    onSelectChannel(id, freq);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = customInput.trim().replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
    if (!clean) return;
    soundFx.playTuneClick();
    onSelectChannel(clean, clean.toUpperCase().slice(0, 5));
    setCustomInput('');
    setShowCustomModal(false);
  };

  const handleCopyLink = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('ch', currentChannel);
    navigator.clipboard.writeText(url.toString()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="w-full max-w-md flex flex-col gap-3">
      {/* Preset Chips */}
      <div className="grid grid-cols-4 gap-2">
        {PRESET_CHANNELS.map((ch) => {
          const isActive = currentChannel === ch.id;
          return (
            <button
              key={ch.id}
              onClick={() => handleSelect(ch.id, ch.freq)}
              className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl border text-xs font-mono transition-all duration-200 active:scale-95 ${
                isActive
                  ? 'bg-cyan-500/15 border-cyan-400 text-cyan-300 shadow-[0_0_12px_rgba(0,240,255,0.25)] font-bold'
                  : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
              }`}
            >
              <span className="text-[10px] tracking-wider opacity-70">{ch.name}</span>
              <span className="text-xs font-semibold">{ch.freq}</span>
            </button>
          );
        })}
      </div>

      {/* Custom & Share Row */}
      <div className="flex items-center justify-between gap-2 px-1">
        <button
          onClick={() => setShowCustomModal(!showCustomModal)}
          className="text-xs font-mono text-zinc-400 hover:text-cyan-400 flex items-center gap-1.5 transition-colors"
        >
          <Hash className="w-3.5 h-3.5" />
          <span>{showCustomModal ? 'Close Custom' : 'Custom Channel / Room'}</span>
        </button>

        <button
          onClick={handleCopyLink}
          className="text-xs font-mono text-zinc-400 hover:text-cyan-400 flex items-center gap-1.5 transition-colors"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-medium">Link Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Share Channel Link</span>
            </>
          )}
        </button>
      </div>

      {/* Custom Channel Input Drawer */}
      {showCustomModal && (
        <form onSubmit={handleCustomSubmit} className="flex gap-2 p-2 bg-zinc-900/80 rounded-xl border border-zinc-800">
          <input
            type="text"
            placeholder="Room code (e.g. squad-99)"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            className="flex-1 bg-black/60 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-400 font-mono"
            maxLength={20}
          />
          <button
            type="submit"
            className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-xs rounded-lg transition-colors font-mono"
          >
            Tune
          </button>
        </form>
      )}
    </div>
  );
};
