'use client'
import { useState, useEffect } from 'react'

const INSTITUTION_TYPES = [
  'Private Bank',
  'Savings Bank',
  'Cooperative Bank',
  'Investment Bank',
  'Digital Bank',
  'Insurance (Life)',
  'Insurance (Non-Life)',
  'Reinsurance',
  'Health Insurance',
  'Fintech',
  'Asset Manager',
  'Other',
]

const REGULATORY_FRAMEWORKS = [
  'BaFin', 'Solvency II', 'Basel IV', 'DORA', 'IFRS 17',
  'MiFID II', 'AML/KYC', 'GDPR', 'ECB',
]

const BANK_TYPES = ['Private Bank', 'Savings Bank', 'Cooperative Bank', 'Investment Bank', 'Digital Bank']
const INSURANCE_TYPES = ['Insurance (Life)', 'Insurance (Non-Life)', 'Reinsurance', 'Health Insurance']

const defaultValues = {
  companyName: '',
  institutionType: '',
  country: '',
  website: '',
  numberOfEmployees: '',
  aum: '',              // Assets under Management (schema field name)
  annualRevenue: '',    // Annual Revenue (schema field name)
  regulatoryFrameworks: [],
  assignedConsultantId: '',
  isKeyAccount: false,
  tags: '',
  notes: '',
  // Bank-specific (schema field names)
  coreBankingSystem: '',
  bankingLicense: '',
  regulatoryStatus: '',
  baselIVStatus: '',
  // Insurance-specific (schema field names)
  insuranceType: '',
  solvencyIIStatus: '',
  policySystem: '',
}

export default function AccountForm({ initialValues = {}, onSubmit, isLoading = false, users = [] }) {
  const [form, setForm] = useState({ ...defaultValues, ...initialValues })

  useEffect(() => {
    if (initialValues && Object.keys(initialValues).length > 0) {
      setForm({
        ...defaultValues,
        ...initialValues,
        tags: Array.isArray(initialValues.tags)
          ? initialValues.tags.join(', ')
          : (initialValues.tags || ''),
        regulatoryFrameworks: initialValues.regulatoryFrameworks || [],
      })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const isBank = BANK_TYPES.includes(form.institutionType)
  const isInsurance = INSURANCE_TYPES.includes(form.institutionType)

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function toggleFramework(fw) {
    setForm((prev) => {
      const current = prev.regulatoryFrameworks || []
      return {
        ...prev,
        regulatoryFrameworks: current.includes(fw)
          ? current.filter((f) => f !== fw)
          : [...current, fw],
      }
    })
  }

  function handleSubmit(e) {
    e.preventDefault()
    const payload = {
      companyName: form.companyName,
      institutionType: form.institutionType || null,
      country: form.country || null,
      website: form.website || null,
      notes: form.notes || null,
      numberOfEmployees: form.numberOfEmployees ? Number(form.numberOfEmployees) : null,
      aum: form.aum ? Number(form.aum) : null,
      annualRevenue: form.annualRevenue ? Number(form.annualRevenue) : null,
      regulatoryFrameworks: form.regulatoryFrameworks || [],
      assignedConsultantId: form.assignedConsultantId || null,
      isKeyAccount: Boolean(form.isKeyAccount),
      tags: form.tags
        ? form.tags.split(',').map((t) => t.trim()).filter(Boolean)
        : [],
      // Bank-specific
      coreBankingSystem: form.coreBankingSystem || null,
      bankingLicense: form.bankingLicense || null,
      regulatoryStatus: form.regulatoryStatus || null,
      baselIVStatus: form.baselIVStatus || null,
      // Insurance-specific
      insuranceType: form.insuranceType || null,
      solvencyIIStatus: form.solvencyIIStatus || null,
      policySystem: form.policySystem || null,
    }
    onSubmit(payload)
  }

  const inputCls = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
  const labelCls = 'block text-sm font-medium text-gray-700 mb-1'

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Basic Info */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelCls}>Firmenname <span className="text-red-500">*</span></label>
          <input
            type="text"
            required
            value={form.companyName}
            onChange={(e) => set('companyName', e.target.value)}
            className={inputCls}
            placeholder="z.B. Deutsche Bank AG"
          />
        </div>

        <div>
          <label className={labelCls}>Institution Type</label>
          <select
            value={form.institutionType}
            onChange={(e) => set('institutionType', e.target.value)}
            className={inputCls}
          >
            <option value="">-- Bitte wählen --</option>
            {INSTITUTION_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelCls}>Land</label>
          <input
            type="text"
            value={form.country}
            onChange={(e) => set('country', e.target.value)}
            className={inputCls}
            placeholder="z.B. Deutschland"
          />
        </div>

        <div>
          <label className={labelCls}>Website</label>
          <input
            type="text"
            value={form.website}
            onChange={(e) => set('website', e.target.value)}
            className={inputCls}
            placeholder="https://..."
          />
        </div>

        <div>
          <label className={labelCls}>Mitarbeiterzahl</label>
          <input
            type="number"
            min="0"
            value={form.numberOfEmployees}
            onChange={(e) => set('numberOfEmployees', e.target.value)}
            className={inputCls}
            placeholder="z.B. 5000"
          />
        </div>

        <div>
          <label className={labelCls}>AuM in Mio. €</label>
          <input
            type="number"
            min="0"
            step="0.1"
            value={form.aum}
            onChange={(e) => set('aum', e.target.value)}
            className={inputCls}
            placeholder="z.B. 1200"
          />
        </div>

        <div>
          <label className={labelCls}>Jahresumsatz in Mio. €</label>
          <input
            type="number"
            min="0"
            step="0.1"
            value={form.annualRevenue}
            onChange={(e) => set('annualRevenue', e.target.value)}
            className={inputCls}
            placeholder="z.B. 500"
          />
        </div>

        <div>
          <label className={labelCls}>Zuständiger Consultant</label>
          <select
            value={form.assignedConsultantId}
            onChange={(e) => set('assignedConsultantId', e.target.value)}
            className={inputCls}
          >
            <option value="">-- Keiner --</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Regulatory Frameworks */}
      <div>
        <label className={labelCls}>Regulatorische Rahmenwerke</label>
        <div className="grid grid-cols-3 gap-2">
          {REGULATORY_FRAMEWORKS.map((fw) => (
            <label key={fw} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={form.regulatoryFrameworks?.includes(fw) || false}
                onChange={() => toggleFramework(fw)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-gray-700">{fw}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Bank-specific fields */}
      {isBank && (
        <div className="border border-blue-100 bg-blue-50 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-blue-800 mb-3">Bank-spezifische Felder</h4>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Core Banking System</label>
              <input
                type="text"
                value={form.coreBankingSystem}
                onChange={(e) => set('coreBankingSystem', e.target.value)}
                className={inputCls}
                placeholder="z.B. Temenos T24, Finastra"
              />
            </div>
            <div>
              <label className={labelCls}>Banking Lizenz</label>
              <input
                type="text"
                value={form.bankingLicense}
                onChange={(e) => set('bankingLicense', e.target.value)}
                className={inputCls}
                placeholder="z.B. Volllizenz, E-Geld"
              />
            </div>
            <div>
              <label className={labelCls}>Regulatorischer Status</label>
              <input
                type="text"
                value={form.regulatoryStatus}
                onChange={(e) => set('regulatoryStatus', e.target.value)}
                className={inputCls}
                placeholder="z.B. BaFin-beaufsichtigt, EZB-beaufsichtigt"
              />
            </div>
            <div>
              <label className={labelCls}>Basel IV Status</label>
              <select
                value={form.baselIVStatus}
                onChange={(e) => set('baselIVStatus', e.target.value)}
                className={inputCls}
              >
                <option value="">-- Bitte wählen --</option>
                <option value="Compliant">Compliant</option>
                <option value="In Progress">In Progress</option>
                <option value="Not Started">Not Started</option>
                <option value="N/A">N/A</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Insurance-specific fields */}
      {isInsurance && (
        <div className="border border-purple-100 bg-purple-50 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-purple-800 mb-3">Versicherungs-spezifische Felder</h4>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Versicherungstyp (intern)</label>
              <input
                type="text"
                value={form.insuranceType}
                onChange={(e) => set('insuranceType', e.target.value)}
                className={inputCls}
                placeholder="z.B. Kranken, Schaden, Rück"
              />
            </div>
            <div>
              <label className={labelCls}>Solvency II Status</label>
              <select
                value={form.solvencyIIStatus}
                onChange={(e) => set('solvencyIIStatus', e.target.value)}
                className={inputCls}
              >
                <option value="">-- Bitte wählen --</option>
                <option value="Pillar I">Pillar I</option>
                <option value="Pillar II">Pillar II</option>
                <option value="Pillar III">Pillar III</option>
                <option value="Compliant">Compliant</option>
                <option value="In Progress">In Progress</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Policy Management System</label>
              <input
                type="text"
                value={form.policySystem}
                onChange={(e) => set('policySystem', e.target.value)}
                className={inputCls}
                placeholder="z.B. SAP FS-CD, msg.Insurance Suite"
              />
            </div>
          </div>
        </div>
      )}

      {/* Tags & Notes */}
      <div>
        <label className={labelCls}>Tags (kommagetrennt)</label>
        <input
          type="text"
          value={form.tags}
          onChange={(e) => set('tags', e.target.value)}
          className={inputCls}
          placeholder="z.B. strategic, tier-1, fintech"
        />
      </div>

      <div>
        <label className={labelCls}>Notizen</label>
        <textarea
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
          rows={3}
          className={`${inputCls} resize-none`}
          placeholder="Interne Notizen..."
        />
      </div>

      {/* Key Account toggle */}
      <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
        <button
          type="button"
          onClick={() => set('isKeyAccount', !form.isKeyAccount)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 ${
            form.isKeyAccount ? 'bg-amber-500' : 'bg-gray-200'
          }`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            form.isKeyAccount ? 'translate-x-6' : 'translate-x-1'
          }`} />
        </button>
        <div>
          <span className="text-sm font-medium text-gray-900">Key Account</span>
          <p className="text-xs text-gray-500">Markiert diesen Account als strategisch wichtigen Key Account</p>
        </div>
      </div>

      {/* Submit */}
      <div className="flex justify-end gap-3 pt-2">
        <button
          type="submit"
          disabled={isLoading || !form.companyName.trim()}
          className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Speichern...' : 'Speichern'}
        </button>
      </div>
    </form>
  )
}
