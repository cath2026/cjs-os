'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Clock, Play, Square } from 'lucide-react'

type Session = {
  id: string
  started_at: string
  ended_at?: string
  duration_minutes?: number
  notes?: string
}

const SHOP_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

export default function SessionsPage() {
  const supabase = createClient()
  const [sessions, setSessions] = useState<Session[]>([])
  const [activeSession, setActiveSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [employeeId, setEmployeeId] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: emp } = await supabase
      .from('employees')
      .select('id')
      .eq('auth_user_id', user.id)
      .single()

    if (!emp) return
    setEmployeeId(emp.id)

    const { data: allSessions } = await supabase
      .from('work_sessions')
      .select('*')
      .eq('employee_id', emp.id)
      .order('started_at', { ascending: false })

    setSessions(allSessions || [])

    const active = allSessions?.find(s => !s.ended_at)
    setActiveSession(active || null)

    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (!activeSession) return
    const interval = setInterval(() => {
      const diff = (new Date().getTime() - new Date(activeSession.started_at).getTime()) / 1000
      setElapsed(diff)
    }, 1000)
    return () => clearInterval(interval)
  }, [activeSession])

  const handleStartSession = async () => {
    if (!employeeId) return
    setSaving(true)

    const { data } = await supabase
      .from('work_sessions')
      .insert({
        employee_id: employeeId,
        shop_id: SHOP_ID,
        started_at: new Date().toISOString(),
      })
      .select()
      .single()

    await supabase.from('logs').insert({
      shop_id: SHOP_ID,
      employee_id: employeeId,
      action: 'Ouverture session de travail',
      module: 'auth',
    })

    setSaving(false)
    fetchData()
  }

  const handleEndSession = async () => {
    if (!activeSession) return
    setSaving(true)

    const durationMinutes = Math.round(
      (new Date().getTime() - new Date(activeSession.started_at).getTime()) / 60000
    )

    await supabase
      .from('work_sessions')
      .update({
        ended_at: new Date().toISOString(),
        duration_minutes: durationMinutes,
      })
      .eq('id', activeSession.id)

    await supabase.from('logs').insert({
      shop_id: SHOP_ID,
      employee_id: employeeId,
      action: 'Fermeture session de travail',
      module: 'auth',
    })

    setSaving(false)
    setElapsed(0)
    fetchData()
  }

  const formatDuration = (minutes: number) => {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return `${h}h ${m.toString().padStart(2, '0')}m`
  }

  const formatElapsed = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = Math.floor(seconds % 60)
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const totalHours = sessions
    .filter(s => s.duration_minutes)
    .reduce((sum, s) => sum + (s.duration_minutes || 0), 0) / 60

  if (loading) return <div className="p-6 text-stone-400">Chargement...</div>

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-stone-800">Mes sessions de travail</h1>
        <p className="text-stone-500 text-sm">Historique de vos sessions</p>
      </div>

      {/* Session active */}
      <div className="bg-white rounded-xl p-5 shadow-sm mb-6">
        {activeSession ? (
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-sm font-medium text-green-600">Session en cours</span>
              </div>
              <p className="text-xs text-stone-400">
                Démarrée à {new Date(activeSession.started_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </p>
              <p className="text-3xl font-bold text-stone-800 mt-2 font-mono">
                {formatElapsed(elapsed)}
              </p>
            </div>
            <button
              onClick={handleEndSession}
              disabled={saving}
              className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-5 py-3 rounded-xl font-medium transition-colors disabled:opacity-50"
            >
              <Square size={16} />
              Terminer la session
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-stone-700">Aucune session active</p>
              <p className="text-xs text-stone-400 mt-1">
                Total : {totalHours.toFixed(2)}h travaillées
              </p>
            </div>
            <button
              onClick={handleStartSession}
              disabled={saving}
              className="flex items-center gap-2 bg-yellow-600 hover:bg-yellow-700 text-white px-5 py-3 rounded-xl font-medium transition-colors disabled:opacity-50"
            >
              <Play size={16} />
              Démarrer une session
            </button>
          </div>
        )}
      </div>

      {/* Historique */}
      <div className="bg-white rounded-xl shadow-sm">
        <div className="px-5 py-4 border-b border-stone-100">
          <h2 className="font-semibold text-stone-700">Historique</h2>
        </div>
        <div className="divide-y divide-stone-100">
          {sessions.filter(s => s.ended_at).length === 0 ? (
            <div className="p-12 text-center text-stone-400">
              <Clock size={40} className="mx-auto mb-3 text-stone-300" />
              <p>Aucune session terminée</p>
            </div>
          ) : (
            sessions.filter(s => s.ended_at).map((session) => (
              <div key={session.id} className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="text-sm font-medium text-stone-700">
                    {new Date(session.started_at).toLocaleDateString('fr-FR', {
                      day: 'numeric', month: 'long', year: 'numeric'
                    })} à {new Date(session.started_at).toLocaleTimeString('fr-FR', {
                      hour: '2-digit', minute: '2-digit'
                    })}
                  </p>
                  <p className="text-xs text-stone-400 mt-0.5">
                    Terminée à {new Date(session.ended_at!).toLocaleTimeString('fr-FR', {
                      hour: '2-digit', minute: '2-digit'
                    })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-stone-800">
                    {formatDuration(session.duration_minutes || 0)}
                  </p>
                  <p className="text-xs text-stone-400">Durée</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}