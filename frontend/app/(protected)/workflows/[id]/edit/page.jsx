'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import toast from 'react-hot-toast'
import WorkflowBuilder from '@/components/workflows/WorkflowBuilder'

export default function EditWorkflowPage() {
  const { id } = useParams()
  const router = useRouter()
  const [workflow, setWorkflow] = useState(null)

  useEffect(() => {
    if (!id) return
    api.get(`/workflows/${id}`)
      .then(setWorkflow)
      .catch((err) => {
        toast.error(err.message || 'Workflow nicht gefunden')
        router.push('/workflows')
      })
  }, [id, router])

  if (!workflow) {
    return <div className="min-h-screen bg-gray-50" />
  }

  return (
    <WorkflowBuilder
      editWorkflow={workflow}
      onClose={() => router.push('/workflows')}
      onSaved={() => router.push('/workflows')}
    />
  )
}
