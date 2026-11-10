'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft, Upload, Download, ShieldAlert, AlertTriangle,
  CheckCircle2, FileSpreadsheet, Copy,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'

const SOURCES = [
  'Unternehmensregister',
  'BaFin-Unternehmensdatenbank',
  'VDMA-Mitgliederliste',
  'ZVEI-Mitgliederliste',
  'Eigene Recherche (CSV)',
  'Sonstiges',
]

const DECISION_OPTIONS = [
  { value: 'merge', label: 'Zusammenführen' },
  { value: 'create', label: 'Neu anlegen' },
  { value: 'skip', label: 'Überspringen' },
]

const STATUS_BADGES = {
  new: 'bg-green-50 text-green-700 border-green-100',
  duplicate: 'bg-yellow-50 text-yellow-700 border-yellow-100',
  blocked: 'bg-red-50 text-red-700 border-red-100',
}

const STATUS_LABELS = { new: 'Neu', duplicate: 'Dublette', blocked: 'Gesperrt' }

function downloadTemplate() {
  const rows = [
    'Unternehmen;Straße;PLZ;Ort;Bundesland;Mitarbeiter;Branche;Priorität;Ansprechpartner;Quelle;WZ 2008',
    'Muster GmbH;Wiesbaden;Hessen;120;Produktion: Maschinenbau / Elektro;1;Max Mustermann;Unternehmensregister;28',
  ]
  const blob = new Blob(['\uFEFF' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'zielkunden-vorlage.csv'
  link.click()
  URL.revokeObjectURL(url)
}

export default function SprintImportPage() {
  const router = useRouter()
  const [file, setFile] = useState(null)
  const [source, setSource] = useState(SOURCES[0])
  const [sourceDate, setSourceDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [preview, setPreview] = useState(null)
  const [decisions, setDecisions] = useState({})
  const [uploading, setUploading] = useState(false)
  const [importing, setImporting] = useState(false)

  async function previewFile(f) {
    setUploading(true)
    setPreview(null)
    setDecisions({})
    try {
      const fd = new FormData()
      fd.append('file', f)
      const data = await api.upload('/sprint-targets/import/preview', fd)
      setPreview(data)
      const initial = {}
      for (const row of data.rows) {
        if (row.status === 'blocked') initial[row.row] = 'skip'
        else if (row.status === 'duplicate') initial[row.row] = 'merge'
        else initial[row.row] = 'create'
      }
      setDecisions(initial)
    } catch (err) {
      toast.error(err.message || 'Datei konnte nicht gelesen werden')
    } finally {
      setUploading(false)
    }
  }

  function handleFile(f) {
    if (!f) return
    if (!f.name.toLowerCase().endsWith('.csv')) {
      toast.error('Bitte eine CSV-Datei auswählen')
      return
    }
    setFile(f)
    previewFile(f)
  }

  async function handleImport() {
    if (!file || !preview) return
    const planned = preview.rows.filter(
      (r) => r.status !== 'blocked' && (decisions[r.row] === 'create' || decisions[r.row] === 'merge')
    )
    if (planned.length === 0) {
      toast.error('Keine Zeilen zum Import ausgewählt')
      return
    }
    setImporting(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('source', source)
      fd.append('sourceDate', sourceDate)
      fd.append('decisions', JSON.stringify(decisions))
      const result = await api.upload('/sprint-targets/import/commit', fd)
      toast.success(
        `${result.created} angelegt, ${result.merged} zusammengeführt, ${result.skipped} übersprungen` +
        (result.blocked ? `, ${result.blocked} gesperrt` : '')
      )
      if (result.errors?.length) {
        toast.error(`${result.errors.length} Zeile(n) fehlgeschlagen`)
      }
      router.push('/sprint-targets')
    } catch (err) {
      toast.error(err.message || 'Import fehlgeschlagen')
    } finally {
      setImporting(false)
    }
  }

  const blockedRows = preview?.rows.filter((r) => r.status === 'blocked') || []
  const duplicateRows = preview?.rows.filter((r) => r.status === 'duplicate') || []
  const missingSegment = preview?.rows.filter((r) => r.status === 'new' && !r.segment) || []
  const wzMappedRows = preview?.rows.filter((r) => r.wzMatch && r.status !== 'blocked') || []
  const plannedCount = preview
    ? preview.rows.filter(
        (r) => r.status !== 'blocked' && (decisions[r.row] === 'create' || decisions[r.row] === 'merge')
      ).length
    : 0

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/sprint-targets')}
            className="flex items-center gap-1 text-gray-500 hover:text-gray-800 text-sm"
          >
            <ChevronLeft className="w-4 h-4" /> Zurück
          </button>
          <div className="h-5 w-px bg-gray-200" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Listen-Import</h1>
            <p className="text-sm text-gray-500">Zielkunden aus CSV mit Sperrlisten- und Dublettenprüfung</p>
          </div>
        </div>
        <button
          onClick={downloadTemplate}
          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50"
        >
          <Download className="w-4 h-4" /> CSV-Vorlage
        </button>
      </div>

      <div className="text-sm text-blue-800 bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
        Jede Zeile wird vor dem Import gegen die Sperrliste und den bestehenden Bestand geprüft.
        Zeilen auf der Sperrliste werden immer übersprungen.
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        {/* Left */}
        <div className="lg:col-span-2 space-y-4">
          {/* 1 · Quelle & Datei */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-1">1 · Quelle &amp; Datei</h2>
            <p className="text-xs text-gray-500 mb-4">Woher stammt die Liste und welche Datei wird eingelesen?</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Quelle</label>
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Stand der Liste</label>
                <input
                  type="date"
                  value={sourceDate}
                  onChange={(e) => setSourceDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <label className="block text-xs font-medium text-gray-500 mb-1">Datei</label>
            <label
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files?.[0]) }}
              className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-lg px-4 py-8 text-sm text-gray-500 bg-gray-50 hover:border-violet-300 hover:bg-violet-50/40 cursor-pointer transition-colors"
            >
              <Upload className="w-5 h-5 text-gray-400" />
              <span>
                CSV hier ablegen oder <span className="font-semibold text-violet-600">Datei auswählen</span>
              </span>
              <span className="text-xs text-gray-400">Semikolon oder Komma · max. 5.000 Zeilen</span>
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
            </label>

            {file && (
              <div className="mt-3 flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg bg-green-50 border border-green-100">
                <div className="flex items-center gap-2 min-w-0">
                  <FileSpreadsheet className="w-4 h-4 text-green-600 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-green-800 truncate">{file.name}</p>
                    <p className="text-xs text-green-700">
                      {(file.size / 1024).toFixed(0)} KB
                      {preview ? ` · ${preview.summary.rows} Zeilen erkannt` : ''}
                    </p>
                  </div>
                </div>
                {uploading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600" />
                ) : preview ? (
                  <span className="text-xs font-medium text-green-700">Geprüft</span>
                ) : null}
              </div>
            )}
          </div>

          {/* 2 · Sperrlisten-Abgleich */}
          {preview && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-900">2 · Sperrlisten-Abgleich</h2>
                <span className="flex items-center gap-1 text-xs text-red-600">
                  <ShieldAlert className="w-3.5 h-3.5" /> gesperrt: {blockedRows.length}
                </span>
              </div>
              {blockedRows.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-green-700">
                  <CheckCircle2 className="w-4 h-4" />
                  Keine Treffer – {preview.summary.rows} Unternehmen ohne Sperrvermerk
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium">{blockedRows.length} Unternehmen stehen auf der Sperrliste und werden übersprungen.</p>
                      <p className="text-xs mt-1">
                        {blockedRows.map((r) => r.companyName).filter(Boolean).join(', ')}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 3 · Dublettenprüfung */}
          {preview && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-900">3 · Dublettenprüfung</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {duplicateRows.length === 0 ? 'Keine Treffer im bestehenden Bestand' : `${duplicateRows.length} Treffer im CRM`}
                </p>
              </div>
              {duplicateRows.length > 0 && (
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Zeile</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Unternehmen</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Treffer im CRM</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Ähnlichkeit</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Aktion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {duplicateRows.map((row) => (
                      <tr key={row.row} className="border-t border-gray-50">
                        <td className="px-4 py-2.5 text-sm text-gray-500">{row.row}</td>
                        <td className="px-4 py-2.5 text-sm font-medium text-gray-900">{row.companyName}</td>
                        <td className="px-4 py-2.5 text-sm text-gray-600">
                          {row.match?.name}
                          {row.match?.kind === 'account' && <span className="ml-1 text-xs text-gray-400">(Kunde)</span>}
                          {row.match?.kind === 'sprintTarget' && <span className="ml-1 text-xs text-gray-400">(Zielkunde)</span>}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 capitalize">
                            {row.match?.rating}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <select
                            value={decisions[row.row] || 'merge'}
                            onChange={(e) => setDecisions((p) => ({ ...p, [row.row]: e.target.value }))}
                            className="border border-gray-300 rounded-md px-2 py-1 text-xs text-gray-700 bg-white"
                          >
                            {DECISION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* 4 · Feld-Mapping */}
          {preview && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-900">4 · Feld-Mapping</h2>
                <p className="text-xs text-gray-500 mt-0.5">Erkannte CSV-Spalten und ihre Zuordnung</p>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">CSV-Spalte</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">CRM-Feld</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.mapping.map((m) => (
                    <tr key={m.field} className="border-t border-gray-50">
                      <td className="px-4 py-2 text-sm text-gray-600">{m.column}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{m.label}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right: summary */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 lg:sticky lg:top-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Import-Zusammenfassung</h2>

          {!preview ? (
            <p className="text-sm text-gray-400">
              {uploading ? 'Datei wird geprüft …' : 'Noch keine Datei geladen.'}
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <p className="text-2xl font-bold text-gray-900 leading-none">{preview.summary.rows}</p>
                  <p className="text-xs text-gray-500 mt-1">Zeilen erkannt</p>
                </div>
                <div className="rounded-lg border border-red-100 bg-red-50 p-3">
                  <p className="text-2xl font-bold text-red-700 leading-none">{preview.summary.blocked}</p>
                  <p className="text-xs text-red-600 mt-1">gesperrt</p>
                </div>
                <div className="rounded-lg border border-yellow-100 bg-yellow-50 p-3">
                  <p className="text-2xl font-bold text-yellow-700 leading-none">{preview.summary.duplicates}</p>
                  <p className="text-xs text-yellow-700 mt-1">Dubletten</p>
                </div>
                <div className="rounded-lg border border-green-100 bg-green-50 p-3">
                  <p className="text-2xl font-bold text-green-700 leading-none">{plannedCount}</p>
                  <p className="text-xs text-green-700 mt-1">zum Import</p>
                </div>
              </div>

              <div className="space-y-2 text-xs text-gray-600">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                  Nach Priorität sortiert (P1 zuerst)
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                  Größe übernommen, Prüfdatum = {sourceDate ? new Date(sourceDate).toLocaleDateString('de-DE') : 'heute'}
                </div>
                {missingSegment.length > 0 && (
                  <div className="flex items-start gap-2 text-yellow-700">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    {missingSegment.length} Zeile(n) ohne Branche – wird als „Sonstige“ angelegt.
                  </div>
                )}
                {wzMappedRows.length > 0 && (
                  <div className="flex items-start gap-2 text-green-700">
                    <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    {wzMappedRows.length} Zeile(n) über WZ-Mapping ergänzt (
                    {[...new Set(wzMappedRows.map((r) => r.wzMatch.segment))].slice(0, 2).join(', ')}
                    {new Set(wzMappedRows.map((r) => r.wzMatch.segment)).size > 2 ? ' …' : ''})
                  </div>
                )}
              </div>

              <div className="mt-5 pt-4 border-t border-gray-100 flex flex-col gap-2">
                <button
                  onClick={handleImport}
                  disabled={importing || plannedCount === 0}
                  className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700 disabled:opacity-50"
                >
                  <Copy className="w-4 h-4" />
                  {importing ? 'Importiere…' : `${plannedCount} Zielkunden importieren`}
                </button>
                <button
                  onClick={() => router.push('/sprint-targets')}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  Abbrechen
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
