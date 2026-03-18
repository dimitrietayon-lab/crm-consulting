'use client'

import { useState, useEffect, useRef } from 'react'
import { api } from '@/lib/api'
import toast from 'react-hot-toast'
import {
  Newspaper, ExternalLink, Plus, X, Globe, Bot,
  ChevronDown, ChevronUp, Search, Tag, Clock, Languages, Layers,
} from 'lucide-react'
import { formatDate } from '@/lib/utils'

// ─── Constants ────────────────────────────────────────────────────────────────

const SENTIMENT_CONFIG = {
  opportunity: { label: 'Chance',  bg: 'bg-green-100 text-green-800', dot: 'bg-green-500', border: 'border-green-300' },
  risk:        { label: 'Risiko',  bg: 'bg-red-100 text-red-800',     dot: 'bg-red-500',   border: 'border-red-300'   },
  neutral:     { label: 'Neutral', bg: 'bg-gray-100 text-gray-600',   dot: 'bg-gray-400',  border: 'border-gray-300'  },
}

const TIME_RANGES = [
  { value: 'day',    label: 'Heute'           },
  { value: 'week',   label: 'Letzte Woche'    },
  { value: 'month',  label: 'Letzter Monat'   },
  { value: 'custom', label: 'Eigener Zeitraum' },
]

function calcDisplayRange(timeRange, dateFrom, dateTo) {
  if (timeRange === 'custom' && dateFrom && dateTo) {
    return { from: new Date(dateFrom + 'T00:00:00'), to: new Date(dateTo + 'T23:59:59') }
  }
  const now = new Date()
  const from = new Date(now)
  if (timeRange === 'day')        from.setDate(now.getDate() - 1)
  else if (timeRange === 'month') from.setMonth(now.getMonth() - 1)
  else                            from.setDate(now.getDate() - 7)
  return { from, to: now }
}

function fmtDateLabel(d) {
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const LANGUAGES = [
  { value: 'de',   label: 'Deutsch'  },
  { value: 'en',   label: 'Englisch' },
  { value: 'both', label: 'Beide'    },
]

const TOPICS = [
  { id: 'regulation', label: 'Regulierung & Compliance' },
  { id: 'market',     label: 'Markt & Wettbewerb'       },
  { id: 'esg',        label: 'ESG & Nachhaltigkeit'     },
  { id: 'tech',       label: 'Technologie & Innovation' },
  { id: 'ma',         label: 'M&A & Übernahmen'         },
  { id: 'finance',    label: 'Finanzen & Ergebnisse'    },
  { id: 'people',     label: 'Personal & Management'    },
  { id: 'risk',       label: 'Risikomanagement'         },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function SegmentedButtons({ options, value, onChange }) {
  return (
    <div className="inline-flex bg-gray-100 rounded-lg p-1 gap-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
            value === o.value
              ? 'bg-white shadow-sm text-gray-900'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function AccountDropdown({ accounts, value, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const label =
    value.length === 0
      ? 'Alle Accounts'
      : value.length === 1
      ? accounts.find((a) => a.id === value[0])?.companyName || '1 Account'
      : `${value.length} Accounts ausgewählt`

  function toggle(id) {
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id])
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm hover:border-gray-400 transition-colors min-w-48"
      >
        <span className="flex-1 text-left text-gray-700">{label}</span>
        <ChevronDown size={14} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 left-0 bg-white border border-gray-200 rounded-lg shadow-lg w-64 max-h-72 overflow-y-auto">
          <label className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-50 cursor-pointer border-b border-gray-100">
            <input
              type="checkbox"
              checked={value.length === 0}
              onChange={() => onChange([])}
              className="rounded"
            />
            <span className="text-sm font-medium text-gray-700">Alle Accounts</span>
          </label>
          {accounts.map((a) => (
            <label key={a.id} className="flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={value.includes(a.id)}
                onChange={() => toggle(a.id)}
                className="rounded"
              />
              <span className="text-sm text-gray-700">{a.companyName}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

function TopicChip({ topic, selected, onToggle }) {
  return (
    <button
      onClick={() => onToggle(topic.id)}
      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
        selected
          ? 'bg-blue-600 text-white border-blue-600'
          : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600'
      }`}
    >
      {topic.label}
    </button>
  )
}

function KeywordTag({ keyword, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">
      {keyword}
      <button onClick={() => onRemove(keyword)} className="hover:opacity-70 ml-0.5">
        <X size={10} />
      </button>
    </span>
  )
}

function SearchPanel({ accounts, onSearch, running }) {
  const [accountIds,     setAccountIds]     = useState([])
  const [timeRange,      setTimeRange]       = useState('week')
  const [dateFrom,       setDateFrom]        = useState('')
  const [dateTo,         setDateTo]          = useState('')
  const [language,       setLanguage]        = useState('de')
  const [topics,         setTopics]          = useState([])
  const [customKeywords, setCustomKeywords]  = useState([])
  const [kwInput,        setKwInput]         = useState('')

  function toggleTopic(id) {
    setTopics((prev) => prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id])
  }

  function addKeyword() {
    const kw = kwInput.trim()
    if (!kw || customKeywords.includes(kw)) return
    setCustomKeywords((prev) => [...prev, kw])
    setKwInput('')
  }

  function handleSearch() {
    if (timeRange === 'custom' && (!dateFrom || !dateTo)) {
      toast.error('Bitte Von- und Bis-Datum auswählen')
      return
    }
    if (timeRange === 'custom' && dateFrom > dateTo) {
      toast.error('Das Von-Datum muss vor dem Bis-Datum liegen')
      return
    }
    onSearch({ accountIds, timeRange, dateFrom: dateFrom || null, dateTo: dateTo || null, language, topics, customKeywords })
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
        <Search size={15} className="text-gray-400" />
        <span className="text-sm font-semibold text-gray-700">Suchkonfiguration</span>
      </div>

      <div className="p-5 space-y-5">
        {/* Row 1: Accounts + Time range */}
        <div className="flex flex-wrap gap-6">
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <Layers size={12} /> Accounts
            </label>
            <AccountDropdown accounts={accounts} value={accountIds} onChange={setAccountIds} />
          </div>

          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <Clock size={12} /> Zeitspanne
            </label>
            <SegmentedButtons options={TIME_RANGES} value={timeRange} onChange={setTimeRange} />
            {timeRange === 'custom' && (
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="date"
                  value={dateFrom}
                  max={dateTo || undefined}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-gray-400 text-sm">—</span>
                <input
                  type="date"
                  value={dateTo}
                  min={dateFrom || undefined}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <Languages size={12} /> Sprache
            </label>
            <SegmentedButtons options={LANGUAGES} value={language} onChange={setLanguage} />
          </div>
        </div>

        {/* Row 2: Topics */}
        <div className="space-y-2">
          <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
            <Tag size={12} /> Themen
            <span className="font-normal normal-case text-gray-400">(mehrere wählbar)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {TOPICS.map((t) => (
              <TopicChip key={t.id} topic={t} selected={topics.includes(t.id)} onToggle={toggleTopic} />
            ))}
            {topics.length > 0 && (
              <button
                onClick={() => setTopics([])}
                className="text-xs text-gray-400 hover:text-gray-600 underline"
              >
                Alle deaktivieren
              </button>
            )}
          </div>
        </div>

        {/* Row 3: Custom keywords */}
        <div className="space-y-2">
          <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
            <Globe size={12} /> Eigene Keywords
            <span className="font-normal normal-case text-gray-400">(einmalig für diese Suche)</span>
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={kwInput}
              onChange={(e) => setKwInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addKeyword()}
              placeholder="Keyword eingeben + Enter…"
              className="flex-1 max-w-xs border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={addKeyword}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
            >
              <Plus size={14} /> Hinzufügen
            </button>
          </div>
          {customKeywords.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-1">
              {customKeywords.map((kw) => (
                <KeywordTag key={kw} keyword={kw} onRemove={(k) => setCustomKeywords((p) => p.filter((x) => x !== k))} />
              ))}
            </div>
          )}
        </div>

        {/* CTA */}
        <div className="pt-1 border-t border-gray-100 flex items-center justify-between">
          <p className="text-xs text-gray-400">
            Sucht via Google News &amp; Bing News · Kein API-Key benötigt
          </p>
          <button
            onClick={handleSearch}
            disabled={running}
            className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors"
          >
            <Bot size={15} className={running ? 'animate-pulse' : ''} />
            {running ? 'Suche läuft…' : 'Smart-Suche starten'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Permanent keyword manager ────────────────────────────────────────────────

function KeywordManager({ accounts }) {
  const [keywords,    setKeywords]    = useState([])
  const [loading,     setLoading]     = useState(true)
  const [newKeyword,  setNewKeyword]  = useState('')
  const [newAccountId, setNewAccountId] = useState('')
  const [isGlobal,    setIsGlobal]    = useState(false)

  useEffect(() => {
    api.get('/news/keywords').then(setKeywords).catch(() => {}).finally(() => setLoading(false))
  }, [])

  async function addKeyword() {
    if (!newKeyword.trim()) return
    try {
      const kw = await api.post('/news/keywords', {
        keyword: newKeyword.trim(),
        accountId: isGlobal ? null : newAccountId || null,
        global: isGlobal,
      })
      setKeywords((prev) => [kw, ...prev])
      setNewKeyword('')
      toast.success('Keyword hinzugefügt')
    } catch {
      toast.error('Fehler beim Hinzufügen')
    }
  }

  async function deleteKeyword(id) {
    try {
      await api.delete(`/news/keywords/${id}`)
      setKeywords((prev) => prev.filter((k) => k.id !== id))
    } catch {
      toast.error('Fehler beim Löschen')
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
      <h3 className="text-sm font-semibold text-gray-900">Dauerhafte Monitoring-Keywords</h3>
      <p className="text-xs text-gray-500">Diese Keywords werden bei jeder Suche automatisch für den jeweiligen Account verwendet.</p>

      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          placeholder="Neues Keyword…"
          value={newKeyword}
          onChange={(e) => setNewKeyword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addKeyword()}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm flex-1 min-w-40 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {!isGlobal && (
          <select
            value={newAccountId}
            onChange={(e) => setNewAccountId(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none"
          >
            <option value="">Account (optional)</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.companyName}</option>)}
          </select>
        )}
        <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" checked={isGlobal} onChange={(e) => setIsGlobal(e.target.checked)} />
          Global
        </label>
        <button
          onClick={addKeyword}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
        >
          <Plus size={14} /> Hinzufügen
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Laden…</p>
      ) : keywords.length === 0 ? (
        <p className="text-sm text-gray-400">Noch keine Keywords definiert</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {keywords.map((kw) => (
            <span
              key={kw.id}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                kw.global ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
              }`}
            >
              {kw.global && <Globe size={10} />}
              {kw.keyword}
              {kw.account && <span className="opacity-70">({kw.account.companyName})</span>}
              <button onClick={() => deleteKeyword(kw.id)} className="hover:opacity-70"><X size={10} /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── News card ────────────────────────────────────────────────────────────────

function NewsCard({ item }) {
  const cfg = SENTIMENT_CONFIG[item.sentiment] || SENTIMENT_CONFIG.neutral
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-2 hover:border-gray-300 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${cfg.bg}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
              {cfg.label}
            </span>
            {item.account && <span className="text-xs text-gray-500">{item.account.companyName}</span>}
            {item.source  && <span className="text-xs text-gray-400">{item.source}</span>}
          </div>
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-gray-900 hover:text-blue-600 flex items-start gap-1"
          >
            {item.title}
            <ExternalLink size={12} className="mt-0.5 flex-shrink-0 text-gray-400" />
          </a>
          {item.summary && <p className="text-xs text-gray-500 mt-1 leading-relaxed">{item.summary}</p>}
          {item.sentimentReason && <p className="text-xs text-gray-400 mt-0.5 italic">{item.sentimentReason}</p>}
        </div>
        <div className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
          {item.publishedAt ? formatDate(item.publishedAt) : formatDate(item.fetchedAt)}
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function NewsPage() {
  const [news,          setNews]          = useState([])
  const [accounts,      setAccounts]      = useState([])
  const [loading,       setLoading]       = useState(true)
  const [agentRunning,  setAgentRunning]  = useState(false)
  const [filterSentiment, setFilterSentiment] = useState('')
  const [filterAccount,   setFilterAccount]   = useState('')
  const [activeRange,     setActiveRange]     = useState(null) // { from, to, label }
  const [showKeywords,  setShowKeywords]  = useState(false)
  const [panelOpen,     setPanelOpen]     = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/news'),
      api.get('/accounts').then((d) => d?.accounts || d || []),
    ])
      .then(([newsData, accsData]) => {
        setNews(Array.isArray(newsData) ? newsData : [])
        setAccounts(Array.isArray(accsData) ? accsData : [])
      })
      .catch(() => toast.error('Fehler beim Laden'))
      .finally(() => setLoading(false))
  }, [])

  async function handleSearch(config) {
    setAgentRunning(true)
    const range = calcDisplayRange(config.timeRange, config.dateFrom, config.dateTo)
    const rangeLabel = config.timeRange === 'custom'
      ? `${config.dateFrom} – ${config.dateTo}`
      : TIME_RANGES.find((t) => t.value === config.timeRange)?.label || ''
    try {
      await api.post('/news/agent-fetch', config)
      toast.success('Smart-Suche gestartet — Ergebnisse erscheinen in Kürze')
      setTimeout(async () => {
        try {
          const data = await api.get('/news')
          setNews(Array.isArray(data) ? data : [])
          setActiveRange({ ...range, label: rangeLabel })
          setPanelOpen(false)
        } catch {}
        setAgentRunning(false)
      }, 18000)
    } catch (err) {
      toast.error(err.message || 'Fehler beim Starten der Suche')
      setAgentRunning(false)
    }
  }

  const filtered = news.filter((n) => {
    if (filterSentiment && n.sentiment !== filterSentiment) return false
    if (filterAccount  && n.accountId !== filterAccount)   return false
    if (activeRange) {
      const date = n.publishedAt ? new Date(n.publishedAt) : (n.fetchedAt ? new Date(n.fetchedAt) : null)
      if (date && (date < activeRange.from || date > activeRange.to)) return false
    }
    return true
  })

  const counts = {
    opportunity: news.filter((n) => n.sentiment === 'opportunity').length,
    risk:        news.filter((n) => n.sentiment === 'risk').length,
    neutral:     news.filter((n) => n.sentiment === 'neutral').length,
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-sky-600 rounded-lg flex items-center justify-center">
            <Newspaper size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">News & Trigger Monitoring</h1>
            <p className="text-sm text-gray-500">KI-gestützte Nachrichtenrecherche für Ihre Accounts</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowKeywords(!showKeywords)}
            className={`px-3 py-2 border rounded-lg text-sm transition-colors ${
              showKeywords ? 'bg-gray-100 border-gray-300 text-gray-700' : 'border-gray-300 hover:bg-gray-50 text-gray-600'
            }`}
          >
            Dauerhafte Keywords
          </button>
          <button
            onClick={() => setPanelOpen(!panelOpen)}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 text-gray-600"
          >
            <Search size={14} />
            Suchkonfiguration
            {panelOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* Permanent keywords manager */}
      {showKeywords && <KeywordManager accounts={accounts} />}

      {/* Search configuration panel */}
      {panelOpen && (
        <SearchPanel accounts={accounts} onSearch={handleSearch} running={agentRunning} />
      )}

      {/* Running indicator */}
      {agentRunning && (
        <div className="flex items-center gap-3 px-4 py-3 bg-purple-50 border border-purple-200 rounded-lg text-sm text-purple-700">
          <Bot size={16} className="animate-pulse flex-shrink-0" />
          <span>KI-Agent recherchiert und klassifiziert News — dies kann einige Minuten dauern…</span>
        </div>
      )}

      {/* Active date range indicator */}
      {activeRange && (
        <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
          <Clock size={14} className="flex-shrink-0" />
          <span>Zeitraum: <strong>{activeRange.label}</strong> ({fmtDateLabel(activeRange.from)} – {fmtDateLabel(activeRange.to)})</span>
          <button
            onClick={() => setActiveRange(null)}
            className="ml-auto text-blue-500 hover:text-blue-700 flex items-center gap-1 text-xs"
          >
            <X size={12} /> Filter aufheben
          </button>
        </div>
      )}

      {/* Sentiment summary chips */}
      {news.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs text-gray-400 font-medium">Filter:</span>
          {Object.entries(counts).map(([key, count]) => {
            const cfg = SENTIMENT_CONFIG[key]
            return (
              <button
                key={key}
                onClick={() => setFilterSentiment(filterSentiment === key ? '' : key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  filterSentiment === key
                    ? cfg.bg + ' border-transparent'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                {cfg.label} ({count})
              </button>
            )
          })}

          {/* Account filter */}
          <select
            value={filterAccount}
            onChange={(e) => setFilterAccount(e.target.value)}
            className="border border-gray-200 rounded-full px-3 py-1.5 text-xs focus:outline-none bg-white"
          >
            <option value="">Alle Accounts</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.companyName}</option>)}
          </select>

          <span className="text-xs text-gray-400">{filtered.length} Artikel</span>

          {(filterSentiment || filterAccount) && (
            <button
              onClick={() => { setFilterSentiment(''); setFilterAccount('') }}
              className="text-xs text-blue-600 hover:underline"
            >
              Zurücksetzen
            </button>
          )}
        </div>
      )}

      {/* Results */}
      {loading ? (
        <div className="py-10 text-center text-gray-400 text-sm">Laden…</div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center">
          <Bot size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">Noch keine News vorhanden</p>
          <p className="text-gray-400 text-sm mt-1">
            {news.length === 0
              ? 'Konfiguriere die Suche oben und starte die Smart-Suche.'
              : 'Keine Artikel für die aktuellen Filter.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <NewsCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}
