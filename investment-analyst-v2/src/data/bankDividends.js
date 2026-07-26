// bankDividends.js — Static SET bank roster for dividend investors (Jul 2026)
// Used by BankDividendScreener.jsx
//
// Sources:
//   • Broker DPS forecasts — Bangkok Biz News (12 Jul 2026): bangkokbiznews.com/finance/stock/1212504
//   • TTM yield — CompaniesMarketCap & stockanalysis.com (as of 23 Jul 2026)
//   • 8-bank DPS projection 2569 — Line Today analyst note (y.zj8nJk)
//   • SET factsheet — set.or.th
//
// IMPORTANT: refPrice ด้านล่างเป็น "reference price" ไม่ใช่ real-time —
// implied yield ที่คำนวณเป็นประมาณการ ใช้ตัดสินใจเบื้องต้นเท่านั้น
// ผู้ใช้ต้อง verify DPS จริง, payout ratio, NPL/NIM ที่ set.or.th ก่อนซื้อ
// ห้ามใช้ข้อมูลนี้เป็นคำแนะนำการลงทุน

export const BANK_DIVIDENDS = [
  {
    symbol: 'BBL',
    nameTh: 'ธนาคารกรุงเทพ',
    nameEn: 'Bangkok Bank',
    tier: 'big4',
    dpsForecast2569: 9.0,
    dpsGrowth: '+6%',
    refPrice: 195,
    rating: "Moody's A-",
    consecutiveYears: 30,
    hasSpecialDps: false,
    thesis: 'Top pick — quality สูงสุด, dividend 30+ ปี, yield ปานกลาง-สูง',
    risks: ['NPL ใน SME segment', 'FX exposure (international loan book)'],
  },
  {
    symbol: 'KTB',
    nameTh: 'ธนาคารกรุงไทย',
    nameEn: 'Krung Thai Bank',
    tier: 'big4',
    dpsForecast2569: 1.76,
    dpsGrowth: '+16%',
    refPrice: 22,
    rating: 'State-backed (FIDF)',
    consecutiveYears: 25,
    hasSpecialDps: false,
    thesis: 'Yield play — DPS growth สูงสุดใน big 4 + state-backing',
    risks: ['Government policy intervention', 'NPL retail government-backed loans'],
  },
  {
    symbol: 'KBANK',
    nameTh: 'ธนาคารกสิกรไทย',
    nameEn: 'Kasikornbank',
    tier: 'big4',
    dpsForecast2569: 11.5,
    dpsGrowth: 'พิเศษ + ปกติ',
    refPrice: 145,
    rating: "Moody's A- / A3 (Fitch)",
    consecutiveYears: 28,
    hasSpecialDps: true,
    thesis: 'Special situation — มี special DPS ปีนี้ที่อาจยังไม่ priced-in',
    risks: ['NPL corporate concentration', 'ราคา volatile รอบ ex-date'],
  },
  {
    symbol: 'SCB',
    nameTh: 'ธนาคารไทยพาณิชย์',
    nameEn: 'Siam Commercial Bank',
    tier: 'big4',
    dpsForecast2569: 8.5,
    dpsGrowth: '+5%',
    refPrice: 118,
    rating: "Moody's A2",
    consecutiveYears: 28,
    hasSpecialDps: false,
    thesis: 'Balanced core — yield กลาง ๆ, dividend นิ่ง, ไม่มี catalyst',
    risks: ['NIM ทรงตัว', 'NPL retail SME สูงขึ้นในรอบ cycle'],
  },
  {
    symbol: 'TISCO',
    nameTh: 'ทิสโก้ กรุ๊ป',
    nameEn: 'TISCO Financial Group',
    tier: 'mid',
    dpsForecast2569: 7.75,
    dpsGrowth: 'TTM 5.98% (23 Jul 2026)',
    refPrice: 130,
    rating: 'Bank holding (retail/SME focus)',
    consecutiveYears: 18,
    hasSpecialDps: false,
    thesis: 'Mid-cap steady — yield สูง สม่ำเสมอ, ขนาดเล็กกว่า big 4',
    risks: ['Liquidity ต่ำกว่า big 4', 'recession sensitivity ผ่าน retail credit'],
  },
  {
    symbol: 'KKP',
    nameTh: 'เกียรตินาคินภัทร',
    nameEn: 'Kiatnakin Phatra',
    tier: 'mid',
    dpsForecast2569: 6.1,
    dpsGrowth: 'forecast ~7.4%',
    refPrice: 70,
    rating: 'Holdco (bank + securities)',
    consecutiveYears: 12,
    hasSpecialDps: false,
    thesis: 'High yield — ผันผวนสูง, ต้อง watch NPL trending',
    risks: ['NPL ในประวัติสูง', 'ราคาผันผวนตาม SET cycle', 'holdco regulatory'],
  },
];

/**
 * Compute implied yield (%) from DPS and reference price
 * Returns 0 if either argument is missing or 0
 */
export function impliedYield(dps, price) {
  if (!dps || !price) return 0;
  return (dps / price) * 100;
}
