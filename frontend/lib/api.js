const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

function getHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('crm_token') : null
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function handleResponse(res) {
  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('crm_token')
      localStorage.removeItem('crm_user')
      window.location.href = '/login'
    }
    return null
  }
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Request fehlgeschlagen')
  return data
}

export const api = {
  get: (path) =>
    fetch(`${BASE_URL}${path}`, { headers: getHeaders() }).then(handleResponse),

  post: (path, body) =>
    fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(body),
    }).then(handleResponse),

  put: (path, body) =>
    fetch(`${BASE_URL}${path}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(body),
    }).then(handleResponse),

  patch: (path, body) =>
    fetch(`${BASE_URL}${path}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(body),
    }).then(handleResponse),

  delete: (path) =>
    fetch(`${BASE_URL}${path}`, {
      method: 'DELETE',
      headers: getHeaders(),
    }).then(handleResponse),

  upload: (path, formData) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('crm_token') : null
    return fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    }).then(handleResponse)
  },
  uploadPut: (path, formData) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('crm_token') : null
    return fetch(`${BASE_URL}${path}`, {
      method: 'PUT',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    }).then(handleResponse)
  },

  // Lädt eine Datei (z. B. Server-PDF) als Blob und startet den Browser-Download
  download: async (path, fallbackName = 'download.pdf') => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('crm_token') : null
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (res.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('crm_token')
        localStorage.removeItem('crm_user')
        window.location.href = '/login'
      }
      return null
    }
    if (!res.ok) {
      let message = 'Download fehlgeschlagen'
      try {
        const data = await res.json()
        if (data?.error) message = data.error
      } catch {
        // Antwort war kein JSON
      }
      throw new Error(message)
    }

    const disposition =
      res.headers.get('Content-Disposition') || res.headers.get('content-disposition') || ''
    let filename = fallbackName
    const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(disposition)
    const plainMatch = /filename="?([^";]+)"?/i.exec(disposition)
    if (utf8Match) {
      try {
        filename = decodeURIComponent(utf8Match[1].trim())
      } catch {
        filename = utf8Match[1].trim()
      }
    } else if (plainMatch) {
      filename = plainMatch[1].trim()
    }

    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    return filename
  },
}

export default api
