'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from 'recharts'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'

const ASSUMED_DAY_RATE = 1500 // EUR per day
const HOURS_PER_DAY = 8

function buildChartData(timeEntries) {
  if (!timeEntries || timeEntries.length === 0) return []

  const sorted = [...timeEntries].sort((a, b) => new Date(a.date) - new Date(b.date))

  let cumulativeBillable = 0
  let cumulativeNonBillable = 0

  return sorted.map((entry) => {
    if (entry.billable) {
      cumulativeBillable += Number(entry.hours) || 0
    } else {
      cumulativeNonBillable += Number(entry.hours) || 0
    }
    return {
      date: entry.date,
      label: (() => {
        try {
          return format(new Date(entry.date), 'dd.MM.', { locale: de })
        } catch {
          return entry.date
        }
      })(),
      billable: Number(cumulativeBillable.toFixed(1)),
      nonBillable: Number(cumulativeNonBillable.toFixed(1)),
      total: Number((cumulativeBillable + cumulativeNonBillable).toFixed(1)),
    }
  })
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-700 mb-1.5">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }} className="flex gap-2">
          <span className="text-gray-500">
            {p.dataKey === 'billable' ? 'Fakturierbar' : 'Nicht fakturierbar'}:
          </span>
          <span className="font-medium">{p.value} Std.</span>
        </p>
      ))}
      <p className="text-gray-700 font-semibold mt-1.5 border-t pt-1.5">
        Gesamt: {payload.reduce((s, p) => s + (p.value || 0), 0).toFixed(1)} Std.
      </p>
    </div>
  )
}

export default function BudgetBurnChart({ timeEntries = [], budgetPlanned = 0 }) {
  const data = buildChartData(timeEntries)
  const maxBudgetHours = budgetPlanned > 0
    ? Math.round((budgetPlanned / ASSUMED_DAY_RATE) * HOURS_PER_DAY)
    : null

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 bg-gray-50 rounded-lg border border-dashed border-gray-200">
        <p className="text-sm text-gray-400">Noch keine Zeiteinträge vorhanden</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-gray-700">Budget-Burn-Verlauf</h4>
        {maxBudgetHours && (
          <span className="text-xs text-gray-500">
            Max. {maxBudgetHours} Std. ({(ASSUMED_DAY_RATE).toLocaleString('de-DE')} €/Tag)
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="billableGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#2563EB" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#2563EB" stopOpacity={0.03} />
            </linearGradient>
            <linearGradient id="nonBillableGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#94A3B8" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#94A3B8" stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: '#94A3B8' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#94A3B8' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}h`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            formatter={(value) =>
              value === 'billable' ? 'Fakturierbar' : 'Nicht fakturierbar'
            }
            wrapperStyle={{ fontSize: 12 }}
          />
          {maxBudgetHours && (
            <ReferenceLine
              y={maxBudgetHours}
              stroke="#EF4444"
              strokeDasharray="5 3"
              label={{
                value: `Budget-Max (${maxBudgetHours}h)`,
                position: 'insideTopRight',
                fontSize: 10,
                fill: '#EF4444',
              }}
            />
          )}
          <Area
            type="monotone"
            dataKey="nonBillable"
            stackId="1"
            stroke="#94A3B8"
            strokeWidth={2}
            fill="url(#nonBillableGrad)"
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Area
            type="monotone"
            dataKey="billable"
            stackId="1"
            stroke="#2563EB"
            strokeWidth={2}
            fill="url(#billableGrad)"
            dot={false}
            activeDot={{ r: 4 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
