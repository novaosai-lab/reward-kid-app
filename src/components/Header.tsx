'use client';

import { tr } from '@/lib/i18n';
import type { Lang } from '@/lib/types';

interface HeaderProps {
  lang: Lang;
  totalStars: number;
  streak: number;
  onLangToggle: () => void;
}

export function Header({ lang, totalStars, streak, onLangToggle }: HeaderProps) {
  return (
    <header className="bg-amber-400 caution-stripe border-b-4 border-amber-600 px-4 py-3 flex items-center justify-between shadow-lg">
      {/* Logo / title */}
      <div className="flex items-center gap-2">
        <span className="text-3xl">🚜</span>
        <div>
          <h1 className="text-xl font-black text-amber-900 leading-none">
            {tr('app_title', lang)}
          </h1>
          <p className="text-xs font-semibold text-amber-800 opacity-80">
            {tr('app_subtitle', lang)}
          </p>
        </div>
      </div>

      {/* Stars + streak */}
      <div className="flex items-center gap-3">
        {streak > 0 && (
          <div className="flex items-center gap-1 bg-amber-800 text-white px-2 py-1 rounded-full text-sm font-bold">
            🔥 {streak}d
          </div>
        )}
        <div className="bg-amber-900 text-amber-300 px-3 py-1 rounded-full font-black text-lg flex items-center gap-1 shadow-inner">
          ⭐ {totalStars}
        </div>
        {/* Lang toggle */}
        <button
          onClick={onLangToggle}
          className="bg-white text-amber-800 border-2 border-amber-600 rounded-full w-10 h-10 text-sm font-black flex items-center justify-center hover:bg-amber-50 active:scale-95 transition-transform"
          title={tr('language', lang)}
        >
          {lang === 'th' ? 'TH' : 'EN'}
        </button>
      </div>
    </header>
  );
}