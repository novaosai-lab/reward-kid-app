// Apps Script API client
'use client';

import type { AppData, Task, Reward, Log } from './types';

const URL = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL || '';

// Apps Script Web App redirects POST→GET, so we use GET + query params.
// This is the documented Google Apps Script pattern for client-side fetch.
async function call<T = any>(action: string, body: Record<string, any> = {}): Promise<T> {
  if (!URL) {
    throw new Error('NEXT_PUBLIC_APPS_SCRIPT_URL not set — see apps-script/README.md');
  }
  const params = new URLSearchParams({ action, ...Object.fromEntries(
    Object.entries(body).map(([k, v]) => [k, String(v ?? '')])
  ) });
  const res = await fetch(`${URL}?${params.toString()}`, {
    method: 'GET',
    redirect: 'follow',
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data?.error) throw new Error(String(data.error));
  return data as T;
}

export async function fetchAll(): Promise<AppData> {
  return call<AppData>('list_all');
}

export async function createTask(t: Omit<Task, 'created_at'>): Promise<{ ok: boolean; id: string }> {
  return call('create_task', t);
}

export async function createReward(r: Omit<Reward, 'created_at'>): Promise<{ ok: boolean; id: string }> {
  return call('create_reward', r);
}

export async function updateItem(tab: 'tasks' | 'rewards', item: Partial<Task> & { id: string }): Promise<{ ok: boolean }> {
  return call('update_item', { tab, ...item });
}

export async function deleteItem(tab: 'tasks' | 'rewards', id: string): Promise<{ ok: boolean }> {
  return call('delete_item', { tab, id });
}

export async function logTask(task_id: string, points: number, note?: string): Promise<{ ok: boolean; id: string }> {
  return call('log_task', { task_id, points, note });
}