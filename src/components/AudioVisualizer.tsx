import React from 'react';

interface AudioVisualizerProps {
  isRecording: boolean;
  isReceiving: boolean;
  isConnected: boolean;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  isRecording,
  isReceiving,
  isConnected,
}) => {
  const barsCount = 28;

  const getBarHeight = (index: number) => {
    if (!isConnected) return 4;
    if (isRecording) {
      // Dynamic simulated peaks when user is transmitting
      const centerFactor = 1 - Math.abs(index - barsCount / 2) / (barsCount / 2);
      return Math.max(8, Math.sin(Date.now() / 80 + index * 0.4) * 32 * centerFactor + 26);
    }
    if (isReceiving) {
      // High-energy waveform when receiving audio
      const centerFactor = 1 - Math.abs(index - barsCount / 2) / (barsCount / 2);
      return Math.max(10, Math.cos(Date.now() / 60 + index * 0.6) * 36 * centerFactor + 28);
    }
    // Idle gentle baseline noise
    return 4 + (index % 3) * 2;
  };

  const getBarColor = () => {
    if (!isConnected) return 'bg-zinc-800';
    if (isRecording) return 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]';
    if (isReceiving) return 'bg-cyan-400 shadow-[0_0_8px_rgba(0,240,255,0.8)]';
    return 'bg-zinc-700/60';
  };

  return (
    <div className="w-full flex items-center justify-between gap-[2px] h-12 px-3 py-1.5 bg-black/60 rounded-xl border border-white/5 overflow-hidden">
      {Array.from({ length: barsCount }).map((_, i) => (
        <div
          key={i}
          className={`flex-1 rounded-full transition-all duration-75 ${getBarColor()}`}
          style={{
            height: `${getBarHeight(i)}px`,
            maxHeight: '40px',
          }}
        />
      ))}
    </div>
  );
};
