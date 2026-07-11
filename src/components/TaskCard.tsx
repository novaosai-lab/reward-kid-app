'use client';

import { useState } from 'react';
import type { Task, Lang } from '@/lib/types';
import { tr } from '@/lib/i18n';

interface TaskCardProps {
  task: Task;
  lang: Lang;
  onDone: (task: Task) => void;
  completed: boolean;
}

export function TaskCard({ task, lang, onDone, completed }: TaskCardProps) {
  const [bounce, setBounce] = useState(false);
  const title = lang === 'th' ? task.title_th : task.title_en;

  const handleTap = () => {
    if (completed) return;
    setBounce(true);
    setTimeout(() => {
      setBounce(false);
      onDone(task);
    }, 180);
  };

  return (
    <button
      onClick={handleTap}
      disabled={completed}
      className={`
        relative w-full rounded-3xl p-5 flex flex-col items-center gap-2
        border-4 shadow-xl select-none active:scale-95 transition-all duration-150
        ${bounce ? 'scale-95' : 'scale-100'}
        ${completed
          ? 'bg-green-300 border-green-500 opacity-60'
          : 'bg-white border-amber-400 hover:bg-amber-50'
        }
      `}
      style={{ minHeight: 120, touchAction: 'manipulation' }}
    >
      {/* Checkmark overlay */}
      {completed && (
        <div className="absolute inset-0 flex items-center justify-center rounded-3xl bg-green-400/70 z-10">
          <span className="text-6xl">✅</span>
        </div>
      )}

      {/* Icon */}
      <span className={`text-5xl ${completed ? 'grayscale opacity-40' : ''}`}>
        {task.icon}
      </span>

      {/* Title */}
      <span className={`font-black text-lg leading-tight text-center ${completed ? 'line-through text-gray-500' : 'text-gray-800'}`}>
        {title}
      </span>

      {/* Points badge */}
      <span className={`
        absolute top-3 right-3 rounded-full w-10 h-10 flex items-center justify-center
        font-black text-sm text-white shadow-md
        ${completed ? 'bg-green-500' : 'bg-amber-500'}
      `}>
        ⭐{task.points}
      </span>
    </button>
  );
}