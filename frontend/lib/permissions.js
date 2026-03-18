'use client'

import { useState, useEffect, useCallback } from 'react'
import api from './api'

// Cache permissions in module scope so they survive re-renders
let _cache = null
let _cacheTime = 0
const CACHE_TTL = 60_000 // 1 minute

export function usePermissions() {
  const [perms, setPerms] = useState(_cache || {})
  const [loading, setLoading] = useState(!_cache)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.get('/portal/permissions')
      _cache = data
      _cacheTime = Date.now()
      setPerms(data)
    } catch {
      setPerms({})
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!_cache || Date.now() - _cacheTime > CACHE_TTL) {
      refresh()
    }
  }, [refresh])

  function can(featureKey, action = 'view') {
    const p = perms[featureKey]
    if (!p) return false
    switch (action) {
      case 'view':   return !!p.canView
      case 'create': return !!p.canCreate
      case 'edit':   return !!p.canEdit
      case 'delete': return !!p.canDelete
      default:       return false
    }
  }

  function canAny(...featureKeys) {
    return featureKeys.some((k) => can(k))
  }

  return { perms, loading, can, canAny, refresh }
}

export function clearPermissionsCache() {
  _cache = null
  _cacheTime = 0
}
