import React, { useEffect } from 'react'
import {
  Activity,
  BellRing,
  Bitcoin,
  ChartNoAxesCombined,
  CircleDollarSign,
  Clock3,
  Coins,
  Languages,
  Landmark,
  LayoutDashboard,
  ShieldCheck,
  Sparkles,
  Target,
} from 'lucide-react'
import { useMarketStore } from './state/useMarketStore.js'
import { useT } from './lib/useT.js'
import { ErrorBoundary } from './components/ds/ErrorBoundary.jsx'
import PriceHub from './components/btc/PriceHub.jsx'
import CycleIndicators from './components/btc/CycleIndicators.jsx'
import InstitutionalPulse from './components/btc/InstitutionalPulse.jsx'
import TechnicalChart from './components/btc/TechnicalChart.jsx'
import MacroContext from './components/btc/MacroContext.jsx'
import GoldPriceTicker from './components/gold/GoldPriceTicker.jsx'
import GoldChart from './components/gold/GoldChart.jsx'
import ThaiStockHub from './components/thai-stock/ThaiStockHub.jsx'
import BitcoinAlertSystem from './components/alerts/BitcoinAlertSystem.jsx'
import SetAlertSystem from './components/alerts/SetAlertSystem.jsx'
import BankDividendScreener from './components/thai-stock/BankDividendScreener.jsx'

function formatCompactCurrency(value, locale) {
  if (value == null) return '—'
  return new Intl.NumberFormat(locale === 'th' ? 'th-TH' : 'en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

function MarketMetricStrip() {
  const { marketData, locale } = useMarketStore()
  const { btcPrice, btcChange24h, wma200, dxyPrice, loading, error } = marketData
  const riskMetric = btcPrice && wma200 ? btcPrice / wma200 : null
  const changeIsPositive = btcChange24h != null && btcChange24h >= 0

  const metrics = [
    {
      label: 'BTC / USD',
      value: loading && btcPrice == null ? 'Loading…' : formatCompactCurrency(btcPrice, locale),
      note: error ? 'Data source unavailable' : 'Live market price',
      tone: 'violet',
    },
    {
      label: '24H CHANGE',
      value: btcChange24h == null ? '—' : `${changeIsPositive ? '+' : ''}${btcChange24h.toFixed(2)}%`,
      note: changeIsPositive ? 'Positive momentum' : 'Negative momentum',
      tone: changeIsPositive ? 'cyan' : 'rose',
    },
    {
      label: 'CYCLE RATIO',
      value: riskMetric == null ? '—' : `${riskMetric.toFixed(2)}x`,
      note: 'Price / 200WMA',
      tone: 'violet',
    },
    {
      label: 'DXY',
      value: dxyPrice == null ? '—' : Number(dxyPrice).toFixed(2),
      note: 'Macro risk context',
      tone: 'cyan',
    },
  ]

  return (
    <div className="metric-grid" aria-label="Bitcoin market overview">
      {metrics.map((metric) => (
        <article key={metric.label} className={`metric-card metric-card-${metric.tone}`}>
          <div className="metric-card-header">
            <span>{metric.label}</span>
            <span className="metric-status-dot" aria-hidden="true" />
          </div>
          <strong>{metric.value}</strong>
          <span className="metric-note">{metric.note}</span>
        </article>
      ))}
    </div>
  )
}

function BitcoinTab() {
  return (
    <div className="space-y-4 md:space-y-6" data-testid="bitcoin-dashboard">
      <MarketMetricStrip />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 lg:auto-rows-fr">
        <ErrorBoundary><PriceHub /></ErrorBoundary>
        <ErrorBoundary><CycleIndicators /></ErrorBoundary>
        <ErrorBoundary><InstitutionalPulse /></ErrorBoundary>
        <div className="lg:col-span-2 min-h-[420px]">
          <ErrorBoundary><TechnicalChart /></ErrorBoundary>
        </div>
        <div className="lg:col-span-1">
          <ErrorBoundary><MacroContext /></ErrorBoundary>
        </div>
      </div>
    </div>
  )
}

function GoldTab() {
  return (
    <div className="grid grid-cols-1 gap-4 md:gap-6">
      <ErrorBoundary><GoldPriceTicker /></ErrorBoundary>
      <div className="min-h-[420px]">
        <ErrorBoundary><GoldChart /></ErrorBoundary>
      </div>
    </div>
  )
}

function getPageDescription(activeTab, locale) {
  const descriptions = {
    th: {
      bitcoin: 'ติดตามราคา วัฏจักร กระแสเงินสถาบัน และสัญญาณมหภาคในมุมมองเดียว',
      gold: 'ภาพรวมทองคำและแนวโน้มราคาเพื่อประกอบการตัดสินใจ',
      thaiStock: 'ค้นหาและประเมินหุ้นไทยด้วยข้อมูลเชิงเทคนิค',
      btcAlert: 'ตั้งเงื่อนไขความเสี่ยงและแผนรับมือสำหรับ Bitcoin',
      setAlert: 'คำนวณเป้าราคาและขนาดสถานะสำหรับหุ้นไทย',
      dividend: 'สกรีนเนอร์หุ้นปันผล 6 ธนาคาร SET — เทียบ DPS, yield, thesis, risks ต่อตัว',
    },
    en: {
      bitcoin: 'Price, cycle, institutional flow, and macro context in one decision surface.',
      gold: 'Gold market overview and price trend decision support.',
      thaiStock: 'Screen and assess Thai equities with technical context.',
      btcAlert: 'Define Bitcoin risk thresholds and response plans.',
      setAlert: 'Calculate targets and position size for Thai equities.',
      dividend: '6 SET bank dividend screener — compare DPS, yield, thesis, risks per bank',
    },
  }
  return descriptions[locale]?.[activeTab] || descriptions.en.bitcoin
}

export default function App() {
  const { locale, setLocale, marketData, fetchBtcAndMacroData } = useMarketStore()
  const t = useT(locale)
  const [activeTab, setActiveTab] = React.useState('bitcoin')

  useEffect(() => {
    fetchBtcAndMacroData()
  }, [fetchBtcAndMacroData])

  const tabs = [
    { value: 'bitcoin', label: t('tabs.bitcoin'), icon: Bitcoin },
    { value: 'gold', label: t('tabs.gold'), icon: Coins },
    { value: 'thaiStock', label: t('tabs.thaiStock'), icon: ChartNoAxesCombined },
    { value: 'dividend', label: t('tabs.dividend'), icon: Landmark },
    { value: 'btcAlert', label: t('tabs.btcAlert'), icon: BellRing },
    { value: 'setAlert', label: t('tabs.setAlert'), icon: Target },
  ]
  const activeTabMeta = tabs.find((tab) => tab.value === activeTab) || tabs[0]
  const ActiveIcon = activeTabMeta.icon
  const lastUpdated = marketData.lastFetchedAt
    ? new Intl.DateTimeFormat(locale === 'th' ? 'th-TH' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(new Date(marketData.lastFetchedAt))
    : '—'

  return (
    <div className="command-app">
      <aside className="command-sidebar" aria-label="Investment navigation">
        <div className="command-brand">
          <div className="command-brand-mark"><Sparkles size={18} /></div>
          <div>
            <strong>NOVA</strong>
            <span>INVEST V2</span>
          </div>
        </div>

        <div className="command-nav-section">
          <p>MARKETS</p>
          <nav>
            {tabs.slice(0, 4).map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.value
              return (
                <button
                  key={tab.value}
                  type="button"
                  className="command-nav-item"
                  data-active={isActive}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => setActiveTab(tab.value)}
                >
                  <Icon size={17} />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </nav>
        </div>

        <div className="command-nav-section">
          <p>RISK TOOLS</p>
          <nav>
            {tabs.slice(4).map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.value
              return (
                <button
                  key={tab.value}
                  type="button"
                  className="command-nav-item"
                  data-active={isActive}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => setActiveTab(tab.value)}
                >
                  <Icon size={17} />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </nav>
        </div>

        <div className="command-sidebar-status">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} />
            <strong>Decision support</strong>
          </div>
          <span>Signals are informational, not financial advice.</span>
        </div>
      </aside>

      <div className="command-workspace">
        <header className="command-topbar">
          <div className="command-topbar-title">
            <LayoutDashboard size={18} />
            <span>Investment Intelligence</span>
          </div>
          <div className="command-topbar-actions">
            <div className={`live-status ${marketData.error ? 'live-status-error' : ''}`}>
              <span />
              {marketData.error ? 'DATA DEGRADED' : marketData.loading ? 'SYNCING' : 'MARKET DATA LIVE'}
            </div>
            <div className="topbar-clock" title="Last market data update">
              <Clock3 size={15} />
              <span>{lastUpdated}</span>
            </div>
            <div className="locale-switcher" aria-label="Language">
              <Languages size={15} />
              {['th', 'en'].map((value) => (
                <button
                  key={value}
                  type="button"
                  data-active={locale === value}
                  onClick={() => setLocale(value)}
                >
                  {value === 'th' ? 'ไทย' : 'EN'}
                </button>
              ))}
            </div>
          </div>
        </header>

        <nav className="mobile-market-nav" aria-label="Mobile investment navigation">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.value
            return (
              <button
                key={tab.value}
                type="button"
                data-active={isActive}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => setActiveTab(tab.value)}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </nav>

        <main className="command-main">
          <section className="command-page-heading">
            <div>
              <div className="command-eyebrow">
                <ActiveIcon size={14} />
                <span>LIVE DECISION SURFACE</span>
              </div>
              <h1>{activeTabMeta.label}</h1>
              <p>{getPageDescription(activeTab, locale)}</p>
            </div>
            <div className="command-page-health">
              <Activity size={16} />
              <div>
                <strong>{marketData.error ? 'Degraded' : 'Operational'}</strong>
                <span>Last sync {lastUpdated}</span>
              </div>
            </div>
          </section>

          <section className="command-content-surface">
            {activeTab === 'bitcoin' ? (
              <BitcoinTab />
            ) : activeTab === 'gold' ? (
              <GoldTab />
            ) : activeTab === 'thaiStock' ? (
              <ErrorBoundary><ThaiStockHub /></ErrorBoundary>
            ) : activeTab === 'dividend' ? (
              <ErrorBoundary><BankDividendScreener /></ErrorBoundary>
            ) : activeTab === 'btcAlert' ? (
              <ErrorBoundary><BitcoinAlertSystem /></ErrorBoundary>
            ) : (
              <ErrorBoundary><SetAlertSystem /></ErrorBoundary>
            )}
          </section>

          <footer className="command-footer">
            <span>{t('app.footer')}</span>
            <span className="flex items-center gap-1.5"><CircleDollarSign size={13} /> Nova Invest V2</span>
          </footer>
        </main>
      </div>
    </div>
  )
}
