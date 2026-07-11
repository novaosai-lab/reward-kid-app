'use client';

import { useState } from 'react';
import type { AppData, Task, Reward, Lang } from '@/lib/types';
import { tr } from '@/lib/i18n';
import { createTask, createReward, updateItem, deleteItem } from '@/lib/api';

type Tab = 'tasks' | 'rewards';

interface ParentPanelProps {
  lang: Lang;
  data: AppData;
  onClose: () => void;
  onRefresh: () => void;
}

export function ParentPanel({ lang, data, onClose, onRefresh }: ParentPanelProps) {
  const [tab, setTab] = useState<Tab>('tasks');
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  // Add form state
  const [icon, setIcon] = useState('⭐');
  const [titleTh, setTitleTh] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [points, setPoints] = useState(2);
  const [cost, setCost] = useState(20);

  const handleAdd = async () => {
    setLoading(true);
    setMsg('');
    try {
      if (tab === 'tasks') {
        await createTask({ id: 't' + Date.now(), icon, title_th: titleTh, title_en: titleEn, points, active: true });
      } else {
        await createReward({ id: 'r' + Date.now(), icon, title_th: titleTh, title_en: titleEn, cost, active: true });
      }
      setShowAdd(false);
      setIcon('⭐'); setTitleTh(''); setTitleEn(''); setPoints(2); setCost(20);
      onRefresh();
      setMsg(lang === 'th' ? '✅ เพิ่มสำเร็จ' : '✅ Added');
    } catch (e: any) {
      setMsg('❌ ' + (e.message || 'Error'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (tab: Tab, id: string) => {
    if (!confirm(lang === 'th' ? 'ลบเลย?' : 'Delete?')) return;
    setLoading(true);
    try {
      await deleteItem(tab, id);
      onRefresh();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[85vh] flex flex-col shadow-2xl border-4 border-amber-400 overflow-hidden">

        {/* Header */}
        <div className="caution-stripe-thin px-4 py-3 flex items-center justify-between border-b-2 border-amber-300">
          <span className="font-black text-amber-900 text-lg">{tr('parent_mode', lang)}</span>
          <button onClick={onClose} className="bg-amber-800 text-white rounded-full w-8 h-8 font-black text-sm hover:bg-amber-700 active:scale-95">
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-amber-200">
          {(['tasks', 'rewards'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setShowAdd(false); }}
              className={`flex-1 py-2 font-black text-sm transition-colors ${tab === t ? 'bg-amber-400 text-amber-900' : 'text-amber-600 hover:bg-amber-50'}`}
            >
              {tr(t === 'tasks' ? 'missions' : 'rewards', lang)}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 scrollbar-hide space-y-2">
          {/* Add form */}
          {showAdd ? (
            <div className="bg-amber-50 rounded-2xl p-4 space-y-3 border-2 border-amber-300">
              <div className="grid grid-cols-3 gap-2">
                <input value={icon} onChange={e => setIcon(e.target.value)}
                  className="col-span-1 text-center text-3xl border-2 border-amber-300 rounded-xl p-2 bg-white"
                  placeholder="⭐" maxLength={4} />
                <input value={titleTh} onChange={e => setTitleTh(e.target.value)}
                  className="col-span-2 border-2 border-amber-300 rounded-xl px-3 py-2 text-sm bg-white"
                  placeholder={tr('title_th', lang)} />
                <input value={titleEn} onChange={e => setTitleEn(e.target.value)}
                  className="col-span-3 border-2 border-amber-300 rounded-xl px-3 py-2 text-sm bg-white"
                  placeholder={tr('title_en', lang)} />
                {tab === 'tasks' ? (
                  <input type="number" value={points} onChange={e => setPoints(+e.target.value)}
                    className="col-span-3 border-2 border-amber-300 rounded-xl px-3 py-2 text-sm bg-white"
                    placeholder={tr('points', lang)} min={1} max={99} />
                ) : (
                  <input type="number" value={cost} onChange={e => setCost(+e.target.value)}
                    className="col-span-3 border-2 border-amber-300 rounded-xl px-3 py-2 text-sm bg-white"
                    placeholder={tr('cost', lang)} min={1} max={999} />
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={handleAdd} disabled={loading}
                  className="flex-1 bg-amber-500 text-white font-black py-2 rounded-xl active:scale-95 disabled:opacity-50">
                  {loading ? '...' : tr('save', lang)}
                </button>
                <button onClick={() => setShowAdd(false)}
                  className="px-4 bg-gray-200 text-gray-700 font-black py-2 rounded-xl active:scale-95">
                  {tr('cancel', lang)}
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowAdd(true)}
              className="w-full bg-amber-400 hover:bg-amber-500 text-amber-900 font-black py-3 rounded-2xl border-2 border-amber-600 active:scale-98 transition-transform">
              + {tab === 'tasks' ? tr('add_mission', lang) : tr('add_reward', lang)}
            </button>
          )}

          {/* List */}
          {(tab === 'tasks' ? data.tasks : data.rewards).map(item => (
            <div key={item.id} className="flex items-center gap-2 bg-white rounded-xl p-3 border-2 border-amber-200 shadow-sm">
              <span className="text-2xl">{item.icon}</span>
              <span className="flex-1 font-semibold text-sm">{lang === 'th'
                ? (item as Task).title_th || (item as Reward).title_th
                : (item as Task).title_en || (item as Reward).title_en}
              </span>
              <span className="text-xs font-bold text-amber-600">
                {tab === 'tasks' ? `⭐${(item as Task).points}` : `⭐${(item as Reward).cost}`}
              </span>
              <button onClick={() => handleDelete(tab, item.id)}
                className="text-red-500 font-black text-xs px-2 py-1 rounded-lg hover:bg-red-50">
                {tr('delete', lang)}
              </button>
            </div>
          ))}

          {msg && <p className="text-center text-sm font-bold text-amber-700">{msg}</p>}
        </div>
      </div>
    </div>
  );
}