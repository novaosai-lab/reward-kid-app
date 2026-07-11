'use client';

import { useEffect, useState, useCallback } from 'react';
import type { AppData, Lang, Task, Reward, Log } from '@/lib/types';
import { tr } from '@/lib/i18n';
import { fetchAll, logTask } from '@/lib/api';
import { Header } from '@/components/Header';
import { TaskCard } from '@/components/TaskCard';
import { RewardCard } from '@/components/RewardCard';
import { Confetti } from '@/components/Confetti';
import { ParentPanel } from '@/components/ParentPanel';
import { LongPressGuard } from '@/components/LongPressGuard';

const TODAY = () => new Date().toISOString().slice(0, 10); // YYYY-MM-DD

export default function RewardKidApp() {
  const [lang, setLang] = useState<Lang>('th');
  const [data, setData] = useState<AppData>({ tasks: [], rewards: [], logs: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showParent, setShowParent] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [confettiMsg, setConfettiMsg] = useState('');
  const [activeTab, setActiveTab] = useState<'missions' | 'rewards' | 'history'>('missions');

  // Completed task IDs today (from logs)
  const completedToday = new Set(
    data.logs
      .filter(l => l.timestamp?.slice(0, 10) === TODAY())
      .map(l => l.task_id)
  );

  // Total stars earned (sum of all logs)
  const totalStars = data.logs.reduce((sum, l) => sum + (Number(l.points) || 0), 0);

  // Streak: consecutive days with at least 1 completed task
  const streak = (() => {
    const dates = [...new Set(data.logs.map(l => l.timestamp?.slice(0, 10)))].sort().reverse();
    let count = 0;
    const today = TODAY();
    let cursor = today;
    for (const d of dates) {
      if (d === cursor || d === new Date(Date.now() - 86400000).toISOString().slice(0, 10)) {
        if (d !== cursor) cursor = d; // allow one gap (yesterday)
        count++;
        cursor = new Date(new Date(cursor).getTime() - 86400000).toISOString().slice(0, 10);
      } else break;
    }
    return count;
  })();

  const load = useCallback(async () => {
    try {
      const d = await fetchAll();
      setData(d);
      setError('');
    } catch (e: any) {
      // If no URL set, show demo data
      if (e.message?.includes('NEXT_PUBLIC_APPS_SCRIPT_URL')) {
        setData(DEMO_DATA);
        setError('⚠️ Set NEXT_PUBLIC_APPS_SCRIPT_URL — showing demo data');
      } else {
        setError(e.message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleTaskDone = async (task: Task) => {
    // Optimistic update
    setData(prev => ({
      ...prev,
      logs: [...prev.logs, { id: 'local-' + Date.now(), timestamp: new Date().toISOString(), task_id: task.id, points: task.points, note: '' }],
    }));
    try {
      await logTask(task.id, task.points);
    } catch { /* keep optimistic state */ }
    setShowConfetti(true);
    setConfettiMsg(tr('great_job', lang));
  };

  const handleRedeem = async (reward: Reward) => {
    if (totalStars < reward.cost) return;
    setShowConfetti(true);
    setConfettiMsg(tr('redeem_ok', lang));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-sky-100">
        <div className="text-6xl wiggle">🚜</div>
        <p className="mt-4 text-xl font-black text-amber-700">{tr('loading', lang)}</p>
      </div>
    );
  }

  return (
    <LongPressGuard onActivate={() => setShowParent(true)}>
      <div className="min-h-screen flex flex-col bg-sky-100">
        <Header
          lang={lang}
          totalStars={totalStars}
          streak={streak}
          onLangToggle={() => setLang(l => l === 'th' ? 'en' : 'th')}
        />

        {error && (
          <div className="mx-4 mt-3 bg-amber-100 border-2 border-amber-400 rounded-2xl px-4 py-2 text-sm font-semibold text-amber-800">
            {error}
          </div>
        )}

        {/* Tab bar */}
        <div className="flex gap-1 px-4 pt-3">
          {(['missions', 'rewards', 'history'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 rounded-2xl font-black text-sm transition-colors border-2 ${
                activeTab === tab
                  ? 'bg-amber-400 border-amber-600 text-amber-900'
                  : 'bg-white border-amber-200 text-amber-600 hover:bg-amber-50'
              }`}
            >
              {tab === 'missions' ? '🚜 ' + tr('missions', lang)
                : tab === 'rewards' ? '🎁 ' + tr('rewards', lang)
                : '📊 ' + tr('history', lang)}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 px-4 pt-3 pb-8 overflow-y-auto scrollbar-hide">

          {/* Missions tab */}
          {activeTab === 'missions' && (
            <div className="grid grid-cols-2 gap-3">
              {data.tasks.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  lang={lang}
                  completed={completedToday.has(task.id)}
                  onDone={handleTaskDone}
                />
              ))}
            </div>
          )}

          {/* Rewards tab */}
          {activeTab === 'rewards' && (
            <div>
              <div className="text-center mb-3">
                <span className="bg-amber-800 text-amber-200 px-4 py-1 rounded-full font-black text-sm">
                  ⭐ {totalStars} {tr('total_stars', lang)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {data.rewards.map(reward => (
                  <RewardCard
                    key={reward.id}
                    reward={reward}
                    lang={lang}
                    earned={totalStars}
                    onRedeem={handleRedeem}
                  />
                ))}
              </div>
            </div>
          )}

          {/* History tab */}
          {activeTab === 'history' && (
            <div className="space-y-2">
              {data.logs.length === 0 && (
                <p className="text-center text-amber-600 font-semibold py-8">{tr('empty', lang)}</p>
              )}
              {data.logs.slice(0, 30).map(log => {
                const task = data.tasks.find(t => t.id === log.task_id);
                const date = log.timestamp ? new Date(log.timestamp).toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US') : '';
                return (
                  <div key={log.id} className="flex items-center gap-3 bg-white rounded-2xl p-3 border-2 border-amber-200 shadow-sm">
                    <span className="text-2xl">{task?.icon || '⭐'}</span>
                    <div className="flex-1">
                      <p className="font-bold text-sm">{lang === 'th' ? (task?.title_th || '?') : (task?.title_en || '?')}</p>
                      <p className="text-xs text-gray-400">{date}</p>
                    </div>
                    <span className="text-amber-500 font-black text-sm">+⭐{log.points}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Parent mode hint */}
        <div className="px-4 pb-3 text-center">
          <span className="text-xs text-amber-600 font-semibold opacity-60">
            👆 {lang === 'th' ? 'กดปุ่ม Parent ค้าง 3 วินาทีเพื่อเพิ่มภารกิจ' : 'Long-press Parent 3s to add missions'}
          </span>
        </div>

        <Confetti active={showConfetti} onDone={() => setShowConfetti(false)} />
        {showParent && (
          <ParentPanel
            lang={lang}
            data={data}
            onClose={() => setShowParent(false)}
            onRefresh={load}
          />
        )}
      </div>
    </LongPressGuard>
  );
}

// Demo data when Apps Script URL is not set
const DEMO_DATA: AppData = {
  tasks: [
    { id: 't1', icon: '🦷', title_th: 'แปรงฟันเช้า', title_en: 'Brush teeth (AM)', points: 2, active: true },
    { id: 't2', icon: '🦷', title_th: 'แปรงฟันเย็น', title_en: 'Brush teeth (PM)', points: 2, active: true },
    { id: 't3', icon: '🧸', title_th: 'เก็บของเล่น',   title_en: 'Tidy up toys',      points: 3, active: true },
    { id: 't4', icon: '🥦', title_th: 'กินผัก',         title_en: 'Eat vegetables',    points: 3, active: true },
    { id: 't5', icon: '🚿', title_th: 'อาบน้ำ',        title_en: 'Take a bath',      points: 2, active: true },
    { id: 't6', icon: '📚', title_th: 'ฟังนิทาน',      title_en: 'Listen to story',   points: 3, active: true },
  ],
  rewards: [
    { id: 'r1', icon: '🟡', title_th: 'รถตัก',      title_en: 'Toy excavator',   cost: 20, active: true },
    { id: 'r2', icon: '🔵', title_th: 'รถบรรทุก',   title_en: 'Toy truck',        cost: 30, active: true },
    { id: 'r3', icon: '🔴', title_th: 'รถเครน',     title_en: 'Toy crane',       cost: 50, active: true },
    { id: 'r4', icon: '🧱', title_th: 'บล็อกตัวต่อ', title_en: 'Building blocks', cost: 40, active: true },
  ],
  logs: [],
};