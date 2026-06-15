import React from 'react';
import { Github, Linkedin } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-[#ffc423] px-6 pb-10 pt-10 font-display">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-10 text-center">
        <img
          src="/brand/ohmlet-wordmark.png"
          alt="Ohmlet"
          className="h-14 w-auto md:h-20"
          draggable={false}
        />

        <div className="flex items-center gap-3">
          <a
            href="https://github.com/faith-ogun"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border-2 border-ohmlet-ink bg-white/30 text-ohmlet-ink transition-colors hover:bg-white/60"
          >
            <Github className="h-5 w-5" />
          </a>
          <a
            href="https://www.linkedin.com/in/faith-ogundimu"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="LinkedIn"
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border-2 border-ohmlet-ink bg-white/30 text-ohmlet-ink transition-colors hover:bg-white/60"
          >
            <Linkedin className="h-5 w-5" />
          </a>
        </div>

        <p className="text-sm font-bold text-ohmlet-ink/70">
          © {new Date().getFullYear()} Ohmlet · Learn electronics by building
        </p>
      </div>
    </footer>
  );
};
