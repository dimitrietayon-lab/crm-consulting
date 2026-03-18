import { format, formatDistanceToNow } from 'date-fns'
import { de } from 'date-fns/locale'

export function formatDate(date) {
  if (!date) return '—'
  try {
    return format(new Date(date), 'dd.MM.yyyy', { locale: de })
  } catch {
    return '—'
  }
}

export function formatDateTime(date) {
  if (!date) return '—'
  try {
    return format(new Date(date), 'dd.MM.yyyy HH:mm', { locale: de })
  } catch {
    return '—'
  }
}

export function timeAgo(date) {
  if (!date) return '—'
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true, locale: de })
  } catch {
    return '—'
  }
}

export function formatCurrency(amount) {
  if (amount == null) return '—'
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatNumber(n) {
  if (n == null) return '—'
  return new Intl.NumberFormat('de-DE').format(n)
}

export function cn(...classes) {
  return classes.filter(Boolean).join(' ')
}

export function getInitials(name) {
  if (!name) return '?'
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function truncate(str, length = 50) {
  if (!str) return ''
  return str.length > length ? str.slice(0, length) + '…' : str
}

export function pluralize(count, singular, plural) {
  return count === 1 ? `${count} ${singular}` : `${count} ${plural}`
}
