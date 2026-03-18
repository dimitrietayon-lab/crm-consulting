'use client'

import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { useRouter } from 'next/navigation'
import { Calendar, TrendingUp, Euro } from 'lucide-react'
import { formatCurrency, formatDate, getInitials } from '@/lib/utils'

function ServiceBadge({ type }) {
  if (!type) return null
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100 truncate max-w-[90px]">
      {type}
    </span>
  )
}

export default function DealCard({ deal, isDragOverlay = false }) {
  const router = useRouter()

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: String(deal.id),
    data: { deal },
    disabled: isDragOverlay,
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
    touchAction: 'none',
  }

  const accountName =
    deal.account?.companyName || deal.accountName || '—'

  const assignedName =
    deal.assignedConsultant?.name || deal.assignedTo?.name || deal.assignedToName || null

  function handleClick(e) {
    if (isDragging) return
    router.push(`/pipeline/${deal.id}`)
  }

  const probabilityColor =
    deal.probability >= 70
      ? 'text-green-600'
      : deal.probability >= 40
      ? 'text-yellow-600'
      : 'text-red-500'

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      className={[
        'bg-white rounded-lg border border-gray-200 shadow-sm p-3 cursor-grab active:cursor-grabbing select-none',
        'hover:shadow-md hover:border-gray-300 transition-all duration-150',
        isDragOverlay ? 'shadow-xl rotate-1 border-blue-300 cursor-grabbing' : '',
        isDragging ? 'opacity-40' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Account name */}
      <p className="text-xs text-gray-400 font-medium mb-0.5 truncate">{accountName}</p>

      {/* Deal title */}
      <p className="text-sm font-semibold text-gray-900 leading-snug mb-2 line-clamp-2">
        {deal.title}
      </p>

      {/* Chips row */}
      <div className="flex flex-wrap gap-1.5 mb-2.5">
        {deal.value != null && (
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
            <Euro className="w-3 h-3" />
            {formatCurrency(deal.value).replace('€', '').trim()}
          </span>
        )}
        {deal.probability != null && (
          <span
            className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-semibold bg-gray-50 border border-gray-100 ${probabilityColor}`}
          >
            <TrendingUp className="w-3 h-3" />
            {deal.probability}%
          </span>
        )}
        {deal.serviceType && <ServiceBadge type={deal.serviceType} />}
      </div>

      {/* Bottom row */}
      <div className="flex items-center justify-between">
        {(deal.expectedClose || deal.expectedCloseDate) ? (
          <span className="flex items-center gap-1 text-xs text-gray-400">
            <Calendar className="w-3 h-3" />
            {formatDate(deal.expectedClose || deal.expectedCloseDate)}
          </span>
        ) : (
          <span />
        )}

        {assignedName ? (
          <div
            title={assignedName}
            className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold shrink-0"
          >
            {getInitials(assignedName)}
          </div>
        ) : (
          <div className="w-6 h-6 rounded-full bg-gray-100 border border-dashed border-gray-300 shrink-0" />
        )}
      </div>
    </div>
  )
}
