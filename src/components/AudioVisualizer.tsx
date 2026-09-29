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
  const barsCount = 24;

  const getBarHeight = (index: number) => {
    if (!isConnected) return 3;
    if (isRecording) {
      const centerFactor = 1 - Math.abs(index - barsCount / 2) / (barsCount / 2);
      return Math.max(4, Math.sin(Date.now() / 90 + index * 0.45) * 24 * centerFactor + 16);
    }
    if (isReceiving) {
      const centerFactor = 1 - Math.abs(index - barsCount / 2) / (barsCount / 2);
      return Math.max(5, Math.cos(Date.now() / 70 + index * 0.5) * 26 * centerFactor + 18);
    }
    return 3;
  };

  const getBarColor = () => {
    if (!isConnected) return 'bg-zinc-800';
    if (isRecording) return 'bg-amber-400';
    if (isReceiving) return 'bg-sky-400';
    return 'bg-zinc-800';
  };

  return (
    <div className="w-full flex items-center justify-center gap-1 h-8 px-2 overflow-hidden">
      {Array.from({ length: barsCount }).map((_, i) => (
        <div
          key={i}
          className={`w-1 rounded-full transition-all duration-75 ${getBarColor()}`}
          style={{
            height: `${getBarHeight(i)}px`,
          }}
        />
      ))}
    </div>
  );
};
