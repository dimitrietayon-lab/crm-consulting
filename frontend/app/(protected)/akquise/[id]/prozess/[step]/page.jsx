'use client'

import { useParams } from 'next/navigation'
import StepPage from '@/components/acquisition/StepPage'

export default function AkquiseStepPage() {
  const params = useParams()
  const id = params?.id
  const step = params?.step
  if (!id || !step) return null
  return <StepPage targetId={id} slug={step} />
}
