// Kleiner CSV-Export-Helfer (Semikolon, UTF-8-BOM für Excel)
export function buildCsv(columns, rows) {
  const header = columns.map((c) => c.label)
  const lines = [header.map(quote).join(';')]
  for (const row of rows) {
    lines.push(
      columns
        .map((c) => {
          const value = typeof c.format === 'function' ? c.format(row) : row[c.key]
          return quote(value)
        })
        .join(';')
    )
  }
  return '\uFEFF' + lines.join('\r\n')
}

function quote(value) {
  if (value === null || value === undefined) return '""'
  return `"${String(value).replace(/"/g, '""')}"`
}

export function exportCsv(filename, columns, rows) {
  const csv = buildCsv(columns, rows)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function csvFilename(prefix = 'sprint-export') {
  return `${prefix}-${new Date().toISOString().slice(0, 10)}.csv`
}
