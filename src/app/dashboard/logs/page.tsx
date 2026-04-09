'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Search, Download } from 'lucide-react'

type Log = {
  id: string
  action: string
  module?: string
  employee_name?: string
  details?: Record<string, unknown>
  created_at: string
  employee?: { full_name: string }
}

const SHOP_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

export default function LogsPage() {
  const supabase = createClient()
  const [logs, setLogs] = useState<Log[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [moduleFilter, setModuleFilter] = useState('')

  const fetchLogs = async () => {
    const { data } = await supabase
      .from('logs')
      .select('*, employee:employees(full_name)')
      .eq('shop_id', SHOP_ID)
      .order('created_at', { ascending: false })
      .limit(200)
    setLogs(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchLogs() }, [])

  const modules = [...new Set(logs.map(l => l.module).filter(Boolean))]

  const filtered = logs.filter(l => {
    const matchSearch = l.action.toLowerCase().includes(search.toLowerCase()) ||
      l.employee?.full_name?.toLowerCase().includes(search.toLowerCase())
    const matchModule = moduleFilter ? l.module === moduleFilter : true
    return matchSearch && matchModule
  })

  const moduleColor: Record<string, string> = {
    ventes: 'bg-green-100 text-green-600',
    finance: 'bg-blue-100 text-blue-600',
    produits: 'bg-yellow-100 text-yellow-700',
    clients: 'bg-purple-100 text-purple-600',
    employees: 'bg-orange-100 text-orange-600',
    auth: 'bg-stone-100 text-stone-600',
    stock: 'bg-red-100 text-red-500',
  }

  const handleExport = () => {
    const csv = [
      ['Date', 'Action', 'Module', 'Employé'].join(','),
      ...filtered.map(l => [
        new Date(l.created_at).toLocaleString('fr-FR'),
        `"${l.action}"`,
        l.module || '',
        l.employee?.full_name || '',
      ].join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `logs-cjs-${new Date().toLocaleDateString('fr-FR')}.csv`
    a.click()
  }

  if (loading) return <div className="p-6 text-stone-400">Chargement...</div>

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-stone-800">Logs & Traçabilité</h1>
          <p className="text-stone-500 text-sm">{logs.length} actions enregistrées</p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 border border-stone-300 hover:bg-stone-50 text-stone-600 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Download size={14} />
          Exporter CSV
        </button>
      </div>

      {/* Filtres */}
      <div className="flex gap-3 mb-4">
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une action..."
            className="w-full border border-stone-300 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
          />
        </div>
        <select
          value={moduleFilter}
          onChange={(e) => setModuleFilter(e.target.value)}
          className="border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
        >
          <option value="">Tous les modules</option>
          {modules.map(m => (
            <option key={m} value={m!}>{m}</option>
          ))}
        </select>
      </div>

      {/* Liste */}
      <div className="bg-white rounded-xl shadow-sm divide-y divide-stone-100">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-stone-400">Aucun log trouvé</div>
        ) : (
          filtered.map((log) => (
            <div key={log.id} className="flex items-center gap-4 px-5 py-3">
              <div className="flex-1">
                <p className="text-sm text-stone-700">{log.action}</p>
                {log.employee?.full_name && (
                  <p className="text-xs text-stone-400 mt-0.5">
                    Par {log.employee.full_name}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                {log.module && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${moduleColor[log.module] || 'bg-stone-100 text-stone-500'}`}>
                    {log.module}
                  </span>
                )}
                <p className="text-xs text-stone-400 whitespace-nowrap">
                  {new Date(log.created_at).toLocaleDateString('fr-FR')} à{' '}
                  {new Date(log.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}