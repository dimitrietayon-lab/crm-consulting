'use client'

import { useEffect, useState } from 'react'
import TabBar from './TabBar'
import { getUser } from '@/lib/auth'
import { usePermissions } from '@/lib/permissions'

// Zusammengeführte Seite: CRM- und Akquise-Ansicht in EINER Route, umgeschaltet
// über Tabs. Der Akquise-Tab erscheint nur mit Sprint-Zugriff.
export default function MergedTabs({ crmLabel, akquiseLabel, Primary, Secondary }) {
  const [tab, setTab] = useState('crm')
  const { perms, can } = usePermissions()
  const isAdmin = getUser()?.role === 'admin'
  const hasGranularSprint = Object.keys(perms || {}).some(
    (key) => key.startsWith('sprint_') && key !== 'sprint_targets' && perms[key]?.canView
  )
  const canAkquise = isAdmin || hasGranularSprint || can('sprint_targets')

  // Deep-Link: /<route>?tab=akquise
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('tab') === 'akquise') setTab('akquise')
  }, [])

  const showAkquise = canAkquise && tab === 'akquise'
  const tabs = canAkquise
    ? [{ value: 'crm', label: crmLabel }, { value: 'akquise', label: akquiseLabel }]
    : [{ value: 'crm', label: crmLabel }]

  return (
    <div>
      <TabBar tabs={tabs} active={showAkquise ? 'akquise' : 'crm'} onChange={setTab} />
      {showAkquise ? <Secondary /> : <Primary />}
    </div>
  )
}
