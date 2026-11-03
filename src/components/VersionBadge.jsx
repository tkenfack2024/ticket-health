import { useState, useEffect } from 'react'
import { api } from '../api'

export default function VersionBadge() {
  const [info, setInfo] = useState(null)

  useEffect(() => {
    api.getVersion().then(setInfo).catch(() => {})
  }, [])

  if (!info) return null

  return (
    <div className="px-4 py-2 text-[10px] text-slate-400 dark:text-slate-500 font-mono text-center">
      v{info.version} {info.git && `• ${info.git.hash}`}
    </div>
  )
}