// Shared types for Reward Kid App

export type Task = {
  id: string;
  icon: string;       // emoji หรือ URL
  title_th: string;
  title_en: string;
  points: number;
  active: boolean;
  created_at?: string;
};

export type Reward = {
  id: string;
  icon: string;
  title_th: string;
  title_en: string;
  cost: number;
  active: boolean;
  created_at?: string;
};

export type Log = {
  id: string;
  timestamp: string;  // ISO
  task_id: string;
  points: number;
  note?: string;
};

export type Lang = 'th' | 'en';

export type AppData = {
  tasks: Task[];
  rewards: Reward[];
  logs: Log[];
};