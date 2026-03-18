'use client'

import { useDroppable } from '@dnd-kit/core'
import { Plus } from 'lucide-react'
import DealCard from './DealCard'
import { formatCurrency } from '@/lib/utils'

const STAGE_STYLES = {
  'First Contact': {
    header: 'bg-slate-600 text-white',
    badge: 'bg-slate-500',
    border: 'border-slate-200',
    dot: 'bg-slate-400',
  },
  'Needs Analysis': {
    header: 'bg-blue-600 text-white',
    badge: 'bg-blue-500',
    border: 'border-blue-200',
    dot: 'bg-blue-400',
  },
  'Proposal Sent': {
    header: 'bg-indigo-600 text-white',
    badge: 'bg-indigo-500',
    border: 'border-indigo-200',
    dot: 'bg-indigo-400',
  },
  Negotiation: {
    header: 'bg-yellow-500 text-white',
    badge: 'bg-yellow-400',
    border: 'border-yellow-200',
    dot: 'bg-yellow-400',
  },
  Won: {
    header: 'bg-green-600 text-white',
    badge: 'bg-green-500',
    border: 'border-green-200',
    dot: 'bg-green-400',
  },
  Lost: {
    header: 'bg-red-600 text-white',
    badge: 'bg-red-500',
    border: 'border-red-200',
    dot: 'bg-red-400',
  },
}

const DEFAULT_STYLE = {
  header: 'bg-gray-600 text-white',
  badge: 'bg-gray-500',
  border: 'border-gray-200',
  dot: 'bg-gray-400',
}

export default function KanbanColumn({ stage, deals = [], onAddDeal }) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage,
    data: { stage },
  })

  const style = STAGE_STYLES[stage] || DEFAULT_STYLE
  const totalValue = deals.reduce((sum, d) => sum + (Number(d.value) || 0), 0)

  return (
    <div className="flex flex-col w-72 shrink-0">
      {/* Column header */}
      <div className={`rounded-t-xl px-3 py-2.5 ${style.header}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{stage}</span>
            <span
              className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold ${style.badge} text-white`}
            >
              {deals.length}
            </span>
          </div>
          {onAddDeal && (
            <button
              onClick={() => onAddDeal(stage)}
              className="w-6 h-6 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/35 transition-colors"
              title={`Deal zu ${stage} hinzufügen`}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {totalValue > 0 && (
          <p className="text-xs mt-0.5 opacity-85 font-medium">{formatCurrency(totalValue)}</p>
        )}
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={[
          'flex-1 min-h-[120px] rounded-b-xl border-x border-b p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-260px)]',
          style.border,
          isOver ? 'bg-blue-50/60 border-blue-300' : 'bg-gray-50/50',
          'transition-colors duration-150',
        ].join(' ')}
      >
        {deals.length === 0 ? (
          <div
            className={`flex items-center justify-center h-20 rounded-lg border-2 border-dashed text-xs text-gray-400 ${
              isOver ? 'border-blue-300 text-blue-400 bg-blue-50' : 'border-gray-200'
            } transition-colors`}
          >
            {isOver ? 'Hier ablegen' : 'Keine Deals'}
          </div>
        ) : (
          deals.map((deal) => (
            <DealCard key={deal.id} deal={deal} />
          ))
        )}
      </div>
    </div>
  )
}
