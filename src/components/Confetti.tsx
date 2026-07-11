'use client';

import { useEffect, useRef } from 'react';

const PIECES = 60;
const COLORS = ['#FFC107', '#FF6F00', '#D32F2F', '#1976D2', '#66BB6A', '#FFD600', '#FF8F00', '#E91E63'];

function randomBetween(a: number, b: number) {
  return a + Math.random() * (b - a);
}

export function Confetti({ active, onDone }: { active: boolean; onDone?: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active || !containerRef.current) return;
    const el = containerRef.current;
    el.innerHTML = '';

    for (let i = 0; i < PIECES; i++) {
      const piece = document.createElement('div');
      const size = randomBetween(8, 18);
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      const left = randomBetween(5, 95);
      const delay = randomBetween(0, 1.2);
      const duration = randomBetween(1.8, 3.0);
      const rotation = randomBetween(0, 720);

      piece.style.cssText = `
        position: absolute;
        top: -20px;
        left: ${left}%;
        width: ${size}px;
        height: ${size}px;
        background: ${color};
        border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
        animation: confetti-fall ${duration}s ${delay}s linear forwards;
        transform: rotate(${rotation}deg);
        opacity: 1;
      `;
      el.appendChild(piece);
    }

    const totalTime = (1.2 + 3.0) * 1000;
    const timer = setTimeout(() => {
      el.innerHTML = '';
      onDone?.();
    }, totalTime);

    return () => clearTimeout(timer);
  }, [active, onDone]);

  if (!active) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[100] pointer-events-none overflow-hidden"
    />
  );
}