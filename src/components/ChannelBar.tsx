import React, { useState } from 'react';
import { Copy, Check, Plus, X } from 'lucide-react';
import { soundFx } from '../lib/soundFx';

export interface ChannelPreset {
  id: string;
  name: string;
  freq: string;
}

export const PRESET_CHANNELS: ChannelPreset[] = [
  { id: '32-48', name: 'Ch 1', freq: '32.48' },
  { id: '44-10', name: 'Ch 2', freq: '44.10' },
  { id: '88-50', name: 'Ch 3', freq: '88.50' },
  { id: '107-90', name: 'Ch 4', freq: '107.90' },
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

  const isCustomChannel = !PRESET_CHANNELS.some((p) => p.id === currentChannel);

  return (
    <div className="w-full max-w-sm flex flex-col items-center gap-2.5">
      {/* Clean Segmented Channel Switcher */}
      <div className="flex items-center p-1 bg-zinc-900/90 border border-zinc-800 rounded-full shadow-inner">
        {PRESET_CHANNELS.map((ch) => {
          const isActive = currentChannel === ch.id;
          return (
            <button
              key={ch.id}
              onClick={() => handleSelect(ch.id, ch.freq)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-zinc-100 text-zinc-950 font-semibold shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {ch.freq}
            </button>
          );
        })}

        {isCustomChannel && (
          <span className="px-3 py-1 bg-sky-500/20 text-sky-300 text-xs font-medium rounded-full border border-sky-400/30">
            {currentFreq}
          </span>
        )}

        <button
          onClick={() => setShowCustomModal(!showCustomModal)}
          className={`p-1.5 ml-1 rounded-full text-xs transition-colors ${
            showCustomModal ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'
          }`}
          title="Custom Channel"
        >
          {showCustomModal ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Custom Channel Modal Drawer */}
      {showCustomModal && (
        <form onSubmit={handleCustomSubmit} className="flex gap-2 w-full max-w-xs p-1 bg-zinc-900 border border-zinc-800 rounded-xl">
          <input
            type="text"
            placeholder="Custom room code..."
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            className="flex-1 bg-transparent px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none"
            maxLength={20}
            autoFocus
          />
          <button
            type="submit"
            className="px-3 py-1 bg-zinc-200 hover:bg-white text-zinc-900 font-semibold text-xs rounded-lg transition-colors"
          >
            Join
          </button>
        </form>
      )}

      {/* Share Channel Pill */}
      <button
        onClick={handleCopyLink}
        className="text-[11px] text-zinc-500 hover:text-zinc-300 flex items-center gap-1.5 transition-colors"
      >
        {copied ? (
          <>
            <Check className="w-3 h-3 text-emerald-400" />
            <span className="text-emerald-400">Invite link copied</span>
          </>
        ) : (
          <>
            <Copy className="w-3 h-3" />
            <span>Copy invite link</span>
          </>
        )}
      </button>
    </div>
  );
};
