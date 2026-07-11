// i18n — Thai + English (no external library to keep it tiny for a kid app)

import type { Lang } from './types';

type Dict = Record<string, { th: string; en: string }>;

export const t: Dict = {
  app_title:        { th: '🚜 ภารกิจของไนล์',     en: "🚜 Nile's Missions" },
  app_subtitle:     { th: 'ทำดี ได้รถ!',          en: 'Be good, get toys!' },
  total_stars:      { th: 'ดาวสะสม',              en: 'Total stars' },
  today:            { th: 'วันนี้',                en: 'Today' },
  missions:         { th: 'ภารกิจ',                en: 'Missions' },
  rewards:          { th: 'ของรางวัล',              en: 'Rewards' },
  history:          { th: 'ประวัติ',                en: 'History' },
  done:             { th: 'เสร็จแล้ว!',             en: 'Done!' },
  again:            { th: 'ทำอีกครั้ง',             en: 'Do again' },
  need_more_stars:  { th: 'ดาวยังไม่พอ',           en: 'Need more stars' },
  redeem:           { th: 'แลก!',                  en: 'Redeem!' },
  parent_mode:      { th: 'โหมดผู้ปกครอง',          en: 'Parent mode' },
  add_mission:      { th: '+ เพิ่มภารกิจ',          en: '+ Add mission' },
  add_reward:       { th: '+ เพิ่มของรางวัล',        en: '+ Add reward' },
  save:             { th: 'บันทึก',                 en: 'Save' },
  cancel:           { th: 'ยกเลิก',                 en: 'Cancel' },
  delete:           { th: 'ลบ',                     en: 'Delete' },
  edit:             { th: 'แก้ไข',                  en: 'Edit' },
  icon:             { th: 'ไอคอน (emoji)',          en: 'Icon (emoji)' },
  title_th:         { th: 'ชื่อ (ไทย)',             en: 'Title (Thai)' },
  title_en:         { th: 'ชื่อ (Eng)',             en: 'Title (English)' },
  points:           { th: 'คะแนน',                  en: 'Points' },
  cost:             { th: 'ราคา (ดาว)',             en: 'Cost (stars)' },
  great_job:        { th: 'เก่งมาก! 🎉',            en: 'Great job! 🎉' },
  redeem_ok:        { th: 'ได้ของรางวัลแล้ว! 🎁',    en: 'Got the reward! 🎁' },
  streak:           { th: 'ติดต่อกัน',              en: 'Streak' },
  days:             { th: 'วัน',                    en: 'days' },
  loading:          { th: 'กำลังโหลด...',           en: 'Loading...' },
  empty:            { th: 'ยังไม่มีข้อมูล',          en: 'No data yet' },
  language:         { th: 'ภาษา',                   en: 'Language' },
  close:            { th: 'ปิด',                    en: 'Close' },
};

export function tr(key: keyof typeof t, lang: Lang): string {
  const entry = t[key];
  return entry ? entry[lang] : key;
}