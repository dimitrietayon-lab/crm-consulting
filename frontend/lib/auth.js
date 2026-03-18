export function getUser() {
  if (typeof window === 'undefined') return null
  try {
    return JSON.parse(localStorage.getItem('crm_user'))
  } catch {
    return null
  }
}

export function getToken() {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('crm_token')
}

export function logout() {
  localStorage.removeItem('crm_token')
  localStorage.removeItem('crm_user')
  window.location.href = '/login'
}

export function isAuthenticated() {
  return !!getToken()
}
