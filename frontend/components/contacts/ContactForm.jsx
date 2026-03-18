'use client'
import { useState, useEffect } from 'react'

const HIERARCHY_LEVELS = ['C-Level', 'Managing Director', 'Project Lead', 'Specialist']

const defaultValues = {
  name: '',
  title: '',
  hierarchyLevel: '',
  department: '',
  email: '',
  phone: '',
  linkedIn: '',
  accountIds: [],
  notes: '',
}

export default function ContactForm({ initialValues = {}, onSubmit, isLoading = false, accounts = [] }) {
  const [form, setForm] = useState({ ...defaultValues, ...initialValues })
  const [accountSearch, setAccountSearch] = useState('')

  useEffect(() => {
    if (initialValues && Object.keys(initialValues).length > 0) {
      setForm({
        ...defaultValues,
        ...initialValues,
        accountIds: initialValues.accountIds || [],
      })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function toggleAccount(id) {
    setForm((prev) => {
      const current = prev.accountIds || []
      return {
        ...prev,
        accountIds: current.includes(id)
          ? current.filter((a) => a !== id)
          : [...current, id],
      }
    })
  }

  function handleSubmit(e) {
    e.preventDefault()
    onSubmit({ ...form })
  }

  const filteredAccounts = accounts.filter((a) =>
    a.companyName?.toLowerCase().includes(accountSearch.toLowerCase())
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Name */}
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="z.B. Dr. Anna Müller"
          />
        </div>

        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Position / Titel</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="z.B. Chief Financial Officer"
          />
        </div>

        {/* Hierarchy Level */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Hierarchieebene</label>
          <select
            value={form.hierarchyLevel}
            onChange={(e) => set('hierarchyLevel', e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">-- Bitte wählen --</option>
            {HIERARCHY_LEVELS.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>

        {/* Department */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Abteilung</label>
          <input
            type="text"
            value={form.department}
            onChange={(e) => set('department', e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="z.B. Finance & Controlling"
          />
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">E-Mail</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="anna.mueller@example.com"
          />
        </div>

        {/* Phone */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => set('phone', e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="+49 30 12345678"
          />
        </div>

        {/* LinkedIn */}
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">LinkedIn URL</label>
          <input
            type="url"
            value={form.linkedIn}
            onChange={(e) => set('linkedIn', e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="https://linkedin.com/in/..."
          />
        </div>
      </div>

      {/* Linked Accounts */}
      {accounts.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Verknüpfte Accounts
          </label>
          <input
            type="text"
            value={accountSearch}
            onChange={(e) => setAccountSearch(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-2"
            placeholder="Account suchen..."
          />
          <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-md divide-y divide-gray-100">
            {filteredAccounts.length === 0 ? (
              <p className="text-sm text-gray-500 px-3 py-2">Keine Accounts gefunden</p>
            ) : (
              filteredAccounts.map((account) => (
                <label
                  key={account.id || account._id}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={form.accountIds?.includes(account.id || account._id) || false}
                    onChange={() => toggleAccount(account.id || account._id)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{account.companyName}</p>
                    {account.institutionType && (
                      <p className="text-xs text-gray-500">{account.institutionType}</p>
                    )}
                  </div>
                </label>
              ))
            )}
          </div>
          {form.accountIds?.length > 0 && (
            <p className="text-xs text-blue-600 mt-1">{form.accountIds.length} Account(s) ausgewählt</p>
          )}
        </div>
      )}

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notizen</label>
        <textarea
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
          rows={3}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          placeholder="Interne Notizen..."
        />
      </div>

      {/* Submit */}
      <div className="flex justify-end gap-3 pt-2">
        <button
          type="submit"
          disabled={isLoading}
          className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Speichern...' : 'Speichern'}
        </button>
      </div>
    </form>
  )
}
