export const timeAgo = (dateString) => {
  const diff = Date.now() - new Date(dateString).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins  < 1)   return 'just now'
  if (mins  < 60)  return `${mins}m ago`
  if (hours < 24)  return `${hours}h ago`
  return `${days}d ago`
}

export const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-AU') : '—'

export const formatDateTime = (d) =>
  d ? new Date(d).toLocaleString('en-AU') : '—'

export const formatDateLong = (d) =>
  d ? new Date(d).toLocaleDateString('en-AU', { dateStyle: 'medium' }) : '—'

export const formatDateTimeLong = (d) =>
  d ? new Date(d).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' }) : '—'