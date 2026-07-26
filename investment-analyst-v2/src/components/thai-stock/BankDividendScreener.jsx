// BankDividendScreener.jsx — SET bank dividend screener (Jul 2026 data)
// Surfaces 6 banks sorted by implied yield, with quality + risks + thesis
// New top-level tab wired in App.jsx (value='dividend', icon=Landmark)

import { useMemo, useState } from 'react'
import { AlertCircle, ArrowUpDown, Landmark, ShieldCheck, TrendingUp } from 'lucide-react'
import { BANK_DIVIDENDS, impliedYield } from '../../data/bankDividends.js'

const fmt = (n, d = 2) => Number(n).toFixed(d)

function yieldToneClass(yieldPct) {
  if (yieldPct >= 7) return 'text-emerald-300'
  if (yieldPct >= 5) return 'text-blue-300'
  if (yieldPct >= 3) return 'text-amber-300'
  return 'text-zinc-300'
}

function yieldBarColor(yieldPct) {
  if (yieldPct >= 7) return 'bg-emerald-500'
  if (yieldPct >= 5) return 'bg-blue-500'
  if (yieldPct >= 3) return 'bg-amber-500'
  return 'bg-rose-500'
}

function YieldMeter({ value }) {
  // Visual bar — normalize to 12% ceiling for bar saturation
  const widthPct = Math.min((value / 12) * 100, 100)
  return (
    <div className="h-1.5 w-16 bg-zinc-800 rounded overflow-hidden" aria-hidden="true">
      <div className={`h-full ${yieldBarColor(value)} transition-all`} style={{ width: `${widthPct}%` }} />
    </div>
  )
}

function TierBadge({ tier }) {
  const big4 = tier === 'big4'
  return (
    <span
      className={`px-2 py-0.5 rounded-full border text-[10px] uppercase font-bold tracking-wider ${
        big4
          ? 'border-blue-500/30 bg-blue-500/10 text-blue-300'
          : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
      }`}
    >
      {big4 ? 'Big 4' : 'Mid'}
    </span>
  )
}

function SortableHeader({ label, sortKey, currentSortBy, currentSortDir, onSort, align = 'right' }) {
  const active = currentSortBy === sortKey
  return (
    <th
      className={`py-2 px-3 ${align === 'right' ? 'text-right' : 'text-left'} text-text-muted text-xs uppercase tracking-wider cursor-pointer hover:text-blue-300 select-none`}
      onClick={() => onSort(sortKey)}
    >
      <div className={`inline-flex items-center gap-1 ${align === 'right' ? 'justify-end' : ''}`}>
        {label}
        <ArrowUpDown size={10} className={active ? 'text-blue-300' : 'opacity-40'} />
        {active && <span className="text-[10px]">{currentSortDir === 'asc' ? '↑' : '↓'}</span>}
      </div>
    </th>
  )
}

export default function BankDividendScreener() {
  const [sortBy, setSortBy] = useState('yield') // 'yield' | 'dps'
  const [sortDir, setSortDir] = useState('desc')

  const enriched = useMemo(
    () =>
      BANK_DIVIDENDS.map((b) => ({
        ...b,
        yieldPct: impliedYield(b.dpsForecast2569, b.refPrice),
      })),
    [],
  )

  const rows = useMemo(() => {
    const sorted = [...enriched]
    sorted.sort((a, b) => {
      const av = sortBy === 'yield' ? a.yieldPct : a.dpsForecast2569
      const bv = sortBy === 'yield' ? b.yieldPct : b.dpsForecast2569
      if (av === bv) return 0
      return sortDir === 'asc' ? av - bv : bv - av
    })
    return sorted
  }, [enriched, sortBy, sortDir])

  const topPick = useMemo(() => {
    return [...enriched].sort((a, b) => b.yieldPct - a.yieldPct)[0]
  }, [enriched])

  const avgYield = useMemo(
    () => enriched.reduce((s, b) => s + b.yieldPct, 0) / enriched.length,
    [enriched],
  )

  const big4Count = enriched.filter((b) => b.tier === 'big4').length

  const handleSort = (col) => {
    if (sortBy === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(col)
      setSortDir('desc')
    }
  }

  return (
    <div className="space-y-6" data-testid="bank-dividend-screener">
      <div className="premium-panel p-4 md:p-5">
        <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-3">
          <div>
            <h2 className="text-xl font-bold text-text-primary tracking-tight flex items-center gap-2">
              <span className="w-2 h-8 bg-blue-500 rounded-full inline-block" />
              <Landmark size={18} className="text-blue-400" />
              Bank Dividend Screener
            </h2>
            <p className="text-xs text-text-muted ml-4 mt-1">
              6 SET-listed banks · DPS forecast FY69 (broker, Jul 2026) · implied yield = DPS / refPrice
            </p>
          </div>
          <div className="text-xs px-3 py-2 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-300 max-w-sm">
            <div className="font-bold uppercase tracking-wider mb-0.5 flex items-center gap-1">
              <AlertCircle size={12} /> Verify at set.or.th
            </div>
            <div className="text-[10px] opacity-90">
              refPrice เป็นประมาณการ — verify DPS จริง, payout ratio, NPL/NIM ก่อนตัดสินใจ
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-zinc-900/60 border border-blue-500/30 rounded-xl p-4">
          <div className="text-xs text-text-muted mb-1 uppercase tracking-wider flex items-center gap-1.5">
            <ShieldCheck size={12} className="text-blue-400" />
            Highest implied yield
          </div>
          <div className="text-2xl font-bold text-blue-300">{topPick.symbol}</div>
          <div className="text-xs text-text-muted mt-1">
            {fmt(topPick.yieldPct)}% · {topPick.dpsGrowth}
          </div>
        </div>
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
          <div className="text-xs text-text-muted mb-1 uppercase tracking-wider flex items-center gap-1.5">
            <TrendingUp size={12} className="text-emerald-400" />
            Avg implied yield
          </div>
          <div className="text-2xl font-bold text-zinc-100">{fmt(avgYield)}%</div>
          <div className="text-xs text-text-muted mt-1">across {BANK_DIVIDENDS.length} banks</div>
        </div>
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
          <div className="text-xs text-text-muted mb-1 uppercase tracking-wider">Coverage</div>
          <div className="text-2xl font-bold text-zinc-100">{BANK_DIVIDENDS.length}</div>
          <div className="text-xs text-text-muted mt-1">
            {big4Count} big 4 + {BANK_DIVIDENDS.length - big4Count} mid-cap
          </div>
        </div>
      </div>

      <div className="premium-panel p-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left py-2 pr-3 text-text-muted text-xs uppercase tracking-wider">Symbol</th>
              <th className="text-left py-2 pr-3 text-text-muted text-xs uppercase tracking-wider">Bank</th>
              <th className="text-center py-2 px-3 text-text-muted text-xs uppercase tracking-wider">Tier</th>
              <SortableHeader
                label="DPS 69 (฿)"
                sortKey="dps"
                currentSortBy={sortBy}
                currentSortDir={sortDir}
                onSort={handleSort}
              />
              <th className="text-right py-2 px-3 text-text-muted text-xs uppercase tracking-wider">Ref Price</th>
              <SortableHeader
                label="Yield %"
                sortKey="yield"
                currentSortBy={sortBy}
                currentSortDir={sortDir}
                onSort={handleSort}
              />
              <th className="text-left py-2 px-3 text-text-muted text-xs uppercase tracking-wider hidden md:table-cell">Thesis</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.symbol} className="border-t border-zinc-800 hover:bg-zinc-900/40 transition-colors">
                <td className="py-3 pr-3 font-bold text-blue-300">{r.symbol}</td>
                <td className="py-3 pr-3">
                  <div className="font-medium text-zinc-100">{r.nameEn}</div>
                  <div className="text-[10px] text-text-muted">{r.nameTh}</div>
                </td>
                <td className="py-3 px-3 text-center">
                  <TierBadge tier={r.tier} />
                </td>
                <td className="py-3 px-3 text-right font-mono text-zinc-100">
                  {fmt(r.dpsForecast2569)}
                  {r.hasSpecialDps && (
                    <span className="ml-1 text-amber-300 text-[10px] font-bold" title="Includes special DPS">
                      +sp
                    </span>
                  )}
                </td>
                <td className="py-3 px-3 text-right font-mono text-text-muted">{fmt(r.refPrice, 0)}</td>
                <td className="py-3 px-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <span className={`font-mono font-bold ${yieldToneClass(r.yieldPct)}`}>{fmt(r.yieldPct)}%</span>
                    <YieldMeter value={r.yieldPct} />
                  </div>
                </td>
                <td className="py-3 px-3 hidden md:table-cell text-xs">
                  <div className="text-zinc-300 font-medium">{r.rating}</div>
                  <div className="text-text-muted text-[10px]">{r.thesis}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {rows.slice(0, 4).map((r) => (
          <div key={`thesis-${r.symbol}`} className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-3 text-xs">
            <div className="flex items-center justify-between mb-1.5">
              <strong className="text-blue-300 text-sm">{r.symbol}</strong>
              <span className="text-text-muted text-[10px]">{r.dpsGrowth}</span>
            </div>
            <div className="text-zinc-200 mb-1.5 leading-relaxed">{r.thesis}</div>
            <div className="text-rose-300/80 text-[10px] leading-relaxed">⚠ {r.risks.join(' · ')}</div>
          </div>
        ))}
      </div>

      <div className="text-[10px] text-text-muted text-center leading-relaxed">
        Sources: Broker DPS forecasts — Bangkok Biz News (12 Jul 2026) · TTM yield — CompaniesMarketCap & stockanalysis.com (23 Jul 2026) · SET factsheet — set.or.th<br />
        ข้อมูลนี้เป็น informational เท่านั้น ไม่ใช่คำแนะนำการลงทุน — please verify current yield/payout/NPL at set.or.th before any trade
      </div>
    </div>
  )
}
