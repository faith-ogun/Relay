import React from 'react';

interface RelayLogoProps {
  className?: string;
  tone?: 'light' | 'dark';
  showTagline?: boolean;
}

export const RelayLogo: React.FC<RelayLogoProps> = ({
  className = '',
  tone = 'light',
  showTagline = false,
}) => {
  const textClass = tone === 'dark' ? 'text-[#0a0a0a]' : 'text-[#f3f3f3]';
  const subClass = tone === 'dark' ? 'text-[#3a3a3a]' : 'text-zinc-400';

  return (
    <div className={`inline-flex flex-col leading-none ${className}`}>
      <span
        className={`${textClass} font-black tracking-[-0.06em] uppercase`}
        style={{ fontSize: 'clamp(1.4rem, 2vw, 2.05rem)' }}
      >
        RELAY
      </span>
      {showTagline && (
        <span className={`mt-1 text-[10px] font-bold uppercase tracking-[0.28em] ${subClass}`}>
          Electronics Learning
        </span>
      )}
    </div>
  );
};
