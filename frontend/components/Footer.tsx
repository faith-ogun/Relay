import React from 'react';
import { Github, Linkedin } from 'lucide-react';
import { RelayLogo } from './Logo';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-white/10 bg-[#090c12] px-6 py-12 text-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <RelayLogo showTagline />
          <p className="mt-2 max-w-md text-sm text-white/60">
            AI-guided electronics learning for breadboards, components, and microcontrollers.
          </p>
        </div>

        <div className="flex items-center gap-5">
          <a
            href="https://github.com/faith-ogun"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
            className="text-white/70 transition-colors hover:text-white"
          >
            <Github className="h-5 w-5" />
          </a>
          <a
            href="https://www.linkedin.com/in/faith-ogundimu"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="LinkedIn"
            className="text-white/70 transition-colors hover:text-white"
          >
            <Linkedin className="h-5 w-5" />
          </a>
        </div>
      </div>
    </footer>
  );
};
