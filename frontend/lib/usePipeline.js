'use client'

import { useEffect, useState } from 'react'
import { getPipeline, getPipelines, getPipelineForTarget, subscribePipeline } from './pipeline'

// Liefert einen Workflow (Default ohne Argument) und rendert neu, sobald der
// Cache (z. B. nach Admin-Änderung) aktualisiert wurde. Initial synchron aus
// dem Cache/Seed.
export function usePipeline(pipelineId) {
  const [pipeline, setPipeline] = useState(() => getPipeline(pipelineId))
  useEffect(() => {
    // Bei geänderter pipelineId sofort neu auflösen
    setPipeline(getPipeline(pipelineId))
    return subscribePipeline(() => setPipeline(getPipeline(pipelineId)))
  }, [pipelineId])
  return pipeline
}

// Alle gecachten Workflows.
export function usePipelines() {
  const [list, setList] = useState(getPipelines)
  useEffect(() => subscribePipeline(() => setList(getPipelines())), [])
  return list
}

// Workflow eines konkreten Zielkunden (target.pipelineId → Kampagne → Default).
export function usePipelineFor(target) {
  const pipelineId = target?.pipelineId
  const campaignId = target?.campaignId
  const campaignPipelineId = target?.campaign?.pipelineId
  const [pipeline, setPipeline] = useState(() => getPipelineForTarget(target))
  useEffect(() => {
    setPipeline(getPipelineForTarget(target))
    return subscribePipeline(() => setPipeline(getPipelineForTarget(target)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipelineId, campaignId, campaignPipelineId])
  return pipeline
}
