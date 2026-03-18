'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { toast } from 'react-hot-toast'
import Link from 'next/link'
import {
  ArrowLeft,
  Building2,
  FileText,
  Calendar,
  Upload,
  CheckCircle,
  Save,
  Download,
  FileCheck,
} from 'lucide-react'
import api from '@/lib/api'
import { formatDate, formatCurrency } from '@/lib/utils'
import Badge from '@/components/ui/Badge'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

export default function ContractDetailPage() {
  const router = useRouter()
  const params = useParams()
  const contractId = params?.id

  const [contract, setContract] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    startDate: '',
    endDate: '',
    value: '',
    renewalReminder: '',
  })
  const [uploadingPdf, setUploadingPdf] = useState(false)
  const fileRef = useRef(null)

  const fetchContract = useCallback(async () => {
    try {
      setLoading(true)
      const data = await api.get(`/contracts/${contractId}`)
      setContract(data)
      setForm({
        startDate: data.startDate ? data.startDate.split('T')[0] : '',
        endDate: data.endDate ? data.endDate.split('T')[0] : '',
        value: data.value != null ? String(data.value) : '',
        renewalReminder: data.renewalReminder ? data.renewalReminder.split('T')[0] : '',
      })
    } catch {
      toast.error('Vertrag konnte nicht geladen werden.')
      router.push('/contracts')
    } finally {
      setLoading(false)
    }
  }, [contractId, router])

  useEffect(() => { if (contractId) fetchContract() }, [fetchContract, contractId])

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const updated = await api.put(`/contracts/${contractId}`, {
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        value: form.value !== '' ? parseFloat(form.value) : null,
        renewalReminder: form.renewalReminder || null,
      })
      setContract((prev) => ({ ...prev, ...updated }))
      toast.success('Vertrag gespeichert.')
    } catch {
      toast.error('Fehler beim Speichern.')
    } finally {
      setSaving(false)
    }
  }

  const handleSignedPdfUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploadingPdf(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const updated = await api.upload(`/contracts/${contractId}/sign`, formData)
      setContract((prev) => ({ ...prev, ...updated }))
      toast.success('Unterzeichnetes PDF hochgeladen.')
    } catch {
      toast.error('Upload fehlgeschlagen.')
    } finally {
      setUploadingPdf(false)
      e.target.value = ''
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    )
  }

  if (!contract) return null

  const lineItems = contract.proposal?.lineItems || []
  const totalAmount = lineItems.reduce((sum, item) => sum + (item.total || 0), 0)

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <button
          onClick={() => router.push('/contracts')}
          className="mt-1 p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">
              Vertrag – {contract.account?.companyName || '—'}
            </h1>
            <Badge variant={contract.signedPdfPath ? 'success' : 'warning'}>
              {contract.signedPdfPath ? 'Unterzeichnet' : 'Nicht unterzeichnet'}
            </Badge>
          </div>
          {contract.proposal && (
            <p className="text-sm text-gray-500 mt-1">
              Angebot:{' '}
              <Link href={`/proposals/${contract.proposal.id}`} className="text-blue-600 hover:underline">
                {contract.proposal.title} (v{contract.proposal.version})
              </Link>
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Main: Edit form */}
        <div className="xl:col-span-2 space-y-6">
          {/* Contract Details */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Vertragsdetails bearbeiten</h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />Startdatum</span>
                  </label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />Enddatum</span>
                  </label>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vertragswert (€)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.value}
                    onChange={(e) => setForm((p) => ({ ...p, value: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="z.B. 120000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Verlängerungserinnerung</label>
                  <input
                    type="date"
                    value={form.renewalReminder}
                    onChange={(e) => setForm((p) => ({ ...p, renewalReminder: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Wird gespeichert...' : 'Speichern'}
                </button>
              </div>
            </form>
          </div>

          {/* Line Items from Proposal */}
          {lineItems.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Leistungspositionen (aus Angebot)</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left pb-3 font-medium text-gray-600">Beschreibung</th>
                    <th className="text-right pb-3 font-medium text-gray-600 w-20">Menge</th>
                    <th className="text-left pb-3 font-medium text-gray-600 w-20 pl-4">Einheit</th>
                    <th className="text-right pb-3 font-medium text-gray-600 w-32">Gesamt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {lineItems.map((item, idx) => (
                    <tr key={item.id || idx}>
                      <td className="py-3 text-gray-900">{item.description}</td>
                      <td className="py-3 text-right text-gray-600">{item.quantity}</td>
                      <td className="py-3 pl-4 text-gray-600">{item.unit}</td>
                      <td className="py-3 text-right font-medium">{formatCurrency(item.total || 0)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200">
                    <td colSpan={3} className="pt-4 text-right font-semibold text-gray-900">Gesamt</td>
                    <td className="pt-4 text-right font-bold text-gray-900">{formatCurrency(totalAmount)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Account */}
          {contract.account && (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-600" />
                Account
              </h3>
              <p className="font-medium text-gray-900">{contract.account.companyName}</p>
              {contract.account.institutionType && (
                <p className="text-xs text-gray-500 mt-0.5">{contract.account.institutionType}</p>
              )}
              {contract.account.country && (
                <p className="text-xs text-gray-400">{contract.account.country}</p>
              )}
            </div>
          )}

          {/* Signed PDF Upload */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-green-600" />
              Unterzeichnetes PDF
            </h3>
            {contract.signedPdfPath ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-green-700 bg-green-50 p-2 rounded-lg">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <span className="text-xs font-medium">PDF hochgeladen</span>
                </div>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Neu hochladen
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploadingPdf}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
                {uploadingPdf ? 'Wird hochgeladen...' : 'PDF hochladen'}
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={handleSignedPdfUpload}
            />
          </div>

          {/* Key Dates */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600" />
              Wichtige Daten
            </h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Erstellt</dt>
                <dd className="text-gray-900">{formatDate(contract.createdAt)}</dd>
              </div>
              {contract.startDate && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Start</dt>
                  <dd className="text-gray-900">{formatDate(contract.startDate)}</dd>
                </div>
              )}
              {contract.endDate && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Ende</dt>
                  <dd className="text-gray-900">{formatDate(contract.endDate)}</dd>
                </div>
              )}
              {contract.renewalReminder && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Verlängerung</dt>
                  <dd className="text-gray-900 font-medium">{formatDate(contract.renewalReminder)}</dd>
                </div>
              )}
              {contract.value != null && (
                <div className="flex justify-between border-t border-gray-100 pt-2 mt-2">
                  <dt className="font-semibold text-gray-700">Vertragswert</dt>
                  <dd className="font-bold text-blue-600">{formatCurrency(contract.value)}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Linked Documents */}
          {contract.documents?.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                Dokumente ({contract.documents.length})
              </h3>
              <ul className="space-y-2">
                {contract.documents.slice(0, 5).map((doc) => (
                  <li key={doc.id} className="flex items-center justify-between text-xs">
                    <span className="text-gray-700 truncate flex-1">{doc.name}</span>
                    <a
                      href={`http://localhost:3001/api/documents/${doc.id}/download`}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-2 text-blue-600 hover:text-blue-700 shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
