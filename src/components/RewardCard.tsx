'use client';

import { useState } from 'react';
import type { Reward, Lang } from '@/lib/types';

interface RewardCardProps {
  reward: Reward;
  lang: Lang;
  earned: number;
  onRedeem: (reward: Reward) => void;
}

export function RewardCard({ reward, lang, earned, onRedeem }: RewardCardProps) {
  const [bounce, setBounce] = useState(false);
  const title = lang === 'th' ? reward.title_th : reward.title_en;
  const canAfford = earned >= reward.cost;

  const handleTap = () => {
    if (!canAfford) return;
    setBounce(true);
    setTimeout(() => {
      setBounce(false);
      onRedeem(reward);
    }, 200);
  };

  return (
    <button
      onClick={handleTap}
      disabled={!canAfford}
      className={`
        relative w-full rounded-3xl p-4 flex flex-col items-center gap-2
        border-4 shadow-xl select-none active:scale-95 transition-all duration-150
        ${bounce ? 'scale-95' : 'scale-100'}
        ${!canAfford
          ? 'bg-gray-100 border-gray-300 opacity-60'
          : 'bg-gradient-to-b from-yellow-100 to-amber-200 border-amber-400 hover:from-yellow-200 hover:to-amber-300'
        }
      `}
      style={{ minHeight: 110 }}
    >
      {/* Icon */}
      <span className={`text-4xl ${!canAfford ? 'grayscale opacity-40' : ''}`}>
        {reward.icon}
      </span>

      {/* Title */}
      <span className={`font-black text-sm leading-tight text-center ${!canAfford ? 'text-gray-400' : 'text-gray-800'}`}>
        {title}
      </span>

      {/* Cost badge */}
      <span className={`
        rounded-full px-2 py-0.5 font-black text-xs text-white shadow-md
        ${canAfford ? 'bg-amber-500' : 'bg-gray-400'}
      `}>
        ⭐ {reward.cost}
      </span>

      {/* "Need N more" if can't afford */}
      {!canAfford && (
        <span className="text-xs text-gray-400 font-semibold">
          ⭐ {reward.cost - earned} {lang === 'th' ? 'ดาว ขาดอีก' : 'more stars'}
        </span>
      )}
    </button>
  );
}