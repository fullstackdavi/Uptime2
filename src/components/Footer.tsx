import React from 'react';
import { Instagram, Code2, Briefcase } from 'lucide-react';

export default function Footer() {
  const instagrams = [
    { label: '@layon.dev', url: 'https://instagram.com/layon.dev' },
    { label: '@davi.ink', url: 'https://instagram.com/davi.ink' },
    { label: '@dscompany1_', url: 'https://instagram.com/dscompany1_' },
  ];

  return (
    <footer className="w-full bg-white border-t border-gray-100 py-12 px-6 mt-12">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
        <div className="space-y-4 text-center md:text-left">
          <div className="flex flex-col gap-1">
            <h3 className="text-gray-900 font-black text-xl tracking-tight">João Layon</h3>
            <p className="text-indigo-600 font-bold text-sm uppercase tracking-widest flex items-center gap-2 justify-center md:justify-start">
              <Code2 className="w-4 h-4" />
              Desenvolvedor Fullstack
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <h4 className="text-gray-500 font-bold text-sm flex items-center gap-2 justify-center md:justify-start">
              <Briefcase className="w-4 h-4" />
              CEO DS Company
            </h4>
          </div>
        </div>

        <div className="flex flex-col items-center md:items-end gap-4">
          <p className="text-gray-400 text-xs font-bold uppercase tracking-[0.2em]">Siga-nos no Instagram</p>
          <div className="flex flex-wrap justify-center gap-3">
            {instagrams.map((ig) => (
              <a
                key={ig.label}
                href={ig.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-all hover:scale-105 active:scale-95 group"
              >
                <Instagram className="w-4 h-4 text-pink-600 group-hover:rotate-12 transition-transform" />
                <span className="text-sm font-bold text-gray-700">{ig.label}</span>
              </a>
            ))}
          </div>
        </div>
      </div>
      
      <div className="max-w-6xl mx-auto mt-12 pt-8 border-t border-gray-50 text-center">
        <p className="text-gray-300 text-[10px] font-black uppercase tracking-[0.3em]">
          &copy; 2026 DS COMPANY - TODOS OS DIREITOS RESERVADOS
        </p>
      </div>
    </footer>
  );
}
