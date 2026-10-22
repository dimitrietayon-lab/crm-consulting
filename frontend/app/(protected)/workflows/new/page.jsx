'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense } from 'react'
import WorkflowBuilder from '@/components/workflows/WorkflowBuilder'
import { TEMPLATES } from '@/lib/workflow-config'

function NewWorkflowForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tplIndex = searchParams.get('template')
  const parsed = tplIndex != null ? Number(tplIndex) : NaN
  const tpl = Number.isInteger(parsed) && TEMPLATES[parsed] ? TEMPLATES[parsed] : null

  return (
    <WorkflowBuilder
      editWorkflow={tpl ? { _template: tpl } : null}
      onClose={() => router.push('/workflows')}
      onSaved={() => router.push('/workflows')}
    />
  )
}

export default function NewWorkflowPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <NewWorkflowForm />
    </Suspense>
  )
}
