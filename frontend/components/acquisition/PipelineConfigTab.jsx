'use client'

import WorkflowBuilder from './WorkflowBuilder'

// Kompatibilitäts-Wrapper: der frühere Pipeline-Editor zeigt jetzt den
// Workflow-Builder (Standard-Workflow vorausgewählt).
export default function PipelineConfigTab() {
  return <WorkflowBuilder />
}
