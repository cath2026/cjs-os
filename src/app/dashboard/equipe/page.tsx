'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Target, ShoppingCart, Globe, Clock, ChevronLeft, X } from 'lucide-react'

type Employee = {
  id: string
  full_name: string
  email: string
  role: string
  auth_user_id?: string
}

type EmployeeStats = {
  employee: Employee
  revenue: number
  sales: number
  orders: number
  goal: number
  goalId: string | null
  rate: number
  avgSale: number
  hoursWorked: number
  sessionsCount: number
}

type SaleDetail = {
  id: string
  created_at: string
  total: number
  customer_name?: string
  source: string
}

type SessionDetail = {
  id: string
  started_at: string
  ended_at?: string
  duration_minutes?: number
}

const SHOP_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
const FALLBACK_CYCLE_ID = '00000000-0000-0000-0000-000000000000'

export default function EquipePage() {
  const supabase = createClient()
  const [stats, setStats] = useState<EmployeeStats[]>([])
  const [totalRevenue, setTotalRevenue] = useState(0)
  const [totalSales, setTotalSales] = useState(0)
  const [activeCycleId, setActiveCycleId] = useState<string>(FALLBACK_CYCLE_ID)
  const [startISO, setStartISO] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [selectedStat, setSelectedStat] = useState<EmployeeStats | null>(null)
  const [empSales, setEmpSales] = useState<SaleDetail[]>([])
  const [empSessions, setEmpSessions] = useState<SessionDetail[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [editingGoal, setEditingGoal] = useState<{ id: string; name: string; goalId: string | null } | null>(null)
  const [goalInput, setGoalInput] = useState(0)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500) }
  const formatFCFA = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA'
  const formatDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
  const formatTime = (d: string) => new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

  const fetchData = async () => {
    setLoading(true)

    const { data: employees } = await supabase
      .from('employees').select('*').eq('shop_id', SHOP_ID).eq('is_active', true)

    if (!employees || employees.length === 0) { setLoading(false); return }

    const { data: cycleData } = await supabase
      .from('finance_cycles').select('id, created_at').eq('shop_id', SHOP_ID)
      .eq('status', 'active').order('created_at', { ascending: false }).limit(1).single()

    const cycleId = cycleData?.id || FALLBACK_CYCLE_ID
    setActiveCycleId(cycleId)

    const start = cycleData?.created_at
      ? new Date(cycleData.created_at).toISOString()
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
    setStartISO(start)

    const { data: sales } = await supabase
      .from('sales').select('id, total, employee_id, customer_name, acquisition_source, created_at')
      .eq('shop_id', SHOP_ID).eq('status', 'paid').gte('created_at', start)

    const { data: orders } = await supabase
      .from('orders').select('id, total, auth_user_id, customer_name, created_at')
      .eq('shop_id', SHOP_ID).eq('status', 'livré').gte('created_at', start)

    const { data: sessions } = await supabase
      .from('work_sessions').select('employee_id, duration_minutes').eq('shop_id', SHOP_ID)
      .gte('started_at', start).not('ended_at', 'is', null)

    const { data: goalsData } = await supabase
      .from('performance_goals').select('*').eq('shop_id', SHOP_ID)
      .in('cycle_id', [cycleId, FALLBACK_CYCLE_ID])

    const goals = goalsData || []

    const employeeStats: EmployeeStats[] = employees.map(emp => {
      const empSalesData = sales?.filter(s => s.employee_id === emp.id) || []
      const salesRevenue = empSalesData.reduce((sum, s) => sum + (s.total || 0), 0)
      const empOrdersData = emp.auth_user_id
        ? (orders?.filter(o => o.auth_user_id === emp.auth_user_id) || []) : []
      const ordersRevenue = empOrdersData.reduce((sum, o) => sum + (o.total || 0), 0)
      const totalRev = salesRevenue + ordersRevenue
      const totalVentes = empSalesData.length + empOrdersData.length
      const avgSale = totalVentes > 0 ? totalRev / totalVentes : 0
      const empSessionsData = sessions?.filter(s => s.employee_id === emp.id) || []
      const hoursWorked = empSessionsData.reduce((sum, s) => sum + (s.duration_minutes || 0), 0) / 60
      const goalObj = goals.find(g => g.employee_id === emp.id)
      const goal = goalObj?.target_revenue || 0
      const rate = goal > 0 ? (totalRev / goal) * 100 : 0

      return {
        employee: emp,
        revenue: totalRev,
        sales: empSalesData.length,
        orders: empOrdersData.length,
        goal, goalId: goalObj?.id || null, rate, avgSale,
        hoursWorked, sessionsCount: empSessionsData.length,
      }
    })

    employeeStats.sort((a, b) => b.revenue - a.revenue)
    setStats(employeeStats)
    setTotalRevenue(employeeStats.reduce((sum, s) => sum + s.revenue, 0))
    setTotalSales((sales?.length || 0) + (orders?.length || 0))
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const handleViewDetail = async (stat: EmployeeStats) => {
    setSelectedStat(stat)
    setDetailLoading(true)

    const { data: salesData } = await supabase
      .from('sales').select('id, total, customer_name, acquisition_source, created_at')
      .eq('employee_id', stat.employee.id).eq('status', 'paid')
      .gte('created_at', startISO).order('created_at', { ascending: false })

    const { data: ordersData } = stat.employee.auth_user_id
      ? await supabase.from('orders').select('id, total, customer_name, created_at')
          .eq('auth_user_id', stat.employee.auth_user_id).eq('status', 'livré')
          .gte('created_at', startISO).order('created_at', { ascending: false })
      : { data: [] }

    const allSales: SaleDetail[] = [
      ...(salesData || []).map(s => ({ id: s.id, created_at: s.created_at, total: s.total, customer_name: s.customer_name, source: 'boutique' })),
      ...(ordersData || []).map(o => ({ id: o.id, created_at: o.created_at, total: o.total, customer_name: o.customer_name, source: 'site' })),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    const { data: sessionsData } = await supabase
      .from('work_sessions').select('id, started_at, ended_at, duration_minutes')
      .eq('employee_id', stat.employee.id).gte('started_at', startISO)
      .order('started_at', { ascending: false })

    setEmpSales(allSales)
    setEmpSessions(sessionsData || [])
    setDetailLoading(false)
  }

  const handleSaveGoal = async () => {
    if (!editingGoal || goalInput <= 0) { showToast('Entrez un montant valide'); return }
    setSaving(true)
    try {
      if (editingGoal.goalId) {
        const { error } = await supabase.from('performance_goals')
          .update({ target_revenue: goalInput, updated_at: new Date().toISOString() })
          .eq('id', editingGoal.goalId)
        if (error) throw error
      } else {
        const { error } = await supabase.from('performance_goals').insert({
          shop_id: SHOP_ID, employee_id: editingGoal.id, cycle_id: activeCycleId,
          target_revenue: goalInput, achieved_revenue: 0, achievement_rate: 0,
        })
        if (error) throw error
      }
      showToast('Objectif enregistre')
      setEditingGoal(null)
      fetchData()
    } catch (err: any) {
      showToast('Erreur : ' + (err?.message || 'inconnue'))
    }
    setSaving(false)
  }

  const totalGoal = stats.reduce((sum, s) => sum + s.goal, 0)
  const globalRate = totalGoal > 0 ? (totalRevenue / totalGoal) * 100 : 0

  if (loading) return <div className="p-6 text-stone-400 text-sm">Chargement...</div>

  // VUE DETAIL EMPLOYE
  if (selectedStat) {
    return (
      <div className="p-4 lg:p-6">
        <button onClick={() => setSelectedStat(null)}
          className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800 mb-4">
          <ChevronLeft size={16} /> Retour
        </button>

        {/* Header employé */}
        <div className="bg-white rounded-xl p-4 shadow-sm mb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-yellow-500 flex items-center justify-center text-white text-lg font-bold">
              {selectedStat.employee.full_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-stone-800">{selectedStat.employee.full_name}</p>
              <p className="text-xs text-stone-400">{selectedStat.employee.email}</p>
              <p className="text-xs text-stone-400 capitalize">{selectedStat.employee.role}</p>
            </div>
            <button onClick={() => {
              setEditingGoal({ id: selectedStat.employee.id, name: selectedStat.employee.full_name, goalId: selectedStat.goalId })
              setGoalInput(selectedStat.goal)
            }} className="ml-auto text-xs text-yellow-600 border border-yellow-300 hover:bg-yellow-50 px-3 py-1.5 rounded-lg">
              <Target size={11} className="inline mr-1" />
              {selectedStat.goal > 0 ? 'Modifier objectif' : 'Definir objectif'}
            </button>
          </div>

          {/* Objectif + progression */}
          {selectedStat.goal > 0 && (
            <div className="mb-4">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-stone-500">Progression vers objectif</span>
                <span className={selectedStat.rate >= 100 ? 'text-green-600 font-bold' : 'text-stone-600'}>
                  {selectedStat.rate.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-stone-100 rounded-full h-2.5 mb-1">
                <div className={`h-2.5 rounded-full transition-all ${selectedStat.rate >= 100 ? 'bg-green-500' : 'bg-yellow-500'}`}
                  style={{ width: Math.min(selectedStat.rate, 100) + '%' }} />
              </div>
              <div className="flex justify-between text-xs text-stone-400">
                <span>{formatFCFA(selectedStat.revenue)} realise</span>
                <span>Obj: {formatFCFA(selectedStat.goal)}</span>
              </div>
            </div>
          )}

          {/* KPIs individuels */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-stone-50 rounded-xl p-3">
              <p className="text-xs text-stone-400 mb-1">CA Total</p>
              <p className="font-bold text-stone-800 text-sm">{formatFCFA(selectedStat.revenue)}</p>
            </div>
            <div className="bg-stone-50 rounded-xl p-3">
              <p className="text-xs text-stone-400 mb-1">Ventes</p>
              <p className="font-bold text-stone-800 text-sm">{selectedStat.sales + selectedStat.orders}</p>
              <p className="text-xs text-stone-400">{selectedStat.sales} boutique · {selectedStat.orders} site</p>
            </div>
            <div className="bg-stone-50 rounded-xl p-3">
              <p className="text-xs text-stone-400 mb-1">CA Moyen/vente</p>
              <p className="font-bold text-stone-800 text-sm">{formatFCFA(selectedStat.avgSale)}</p>
            </div>
            <div className="bg-stone-50 rounded-xl p-3">
              <p className="text-xs text-stone-400 mb-1 flex items-center gap-1"><Clock size={10} /> Heures travaillees</p>
              <p className="font-bold text-stone-800 text-sm">{selectedStat.hoursWorked.toFixed(1)}h</p>
              <p className="text-xs text-stone-400">{selectedStat.sessionsCount} sessions</p>
            </div>
          </div>
        </div>

        {detailLoading ? (
          <div className="p-6 text-stone-400 text-sm text-center">Chargement...</div>
        ) : (
          <>
            {/* Ventes */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-4">
              <div className="px-4 py-3 border-b border-stone-100">
                <h3 className="font-semibold text-stone-700 text-sm">Ventes du cycle ({empSales.length})</h3>
              </div>
              {empSales.length === 0 ? (
                <p className="p-6 text-stone-400 text-sm text-center">Aucune vente ce cycle</p>
              ) : (
                <div className="divide-y divide-stone-50 max-h-64 overflow-y-auto">
                  {empSales.map(sale => (
                    <div key={sale.id} className="flex items-center justify-between px-4 py-2.5 gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-stone-700 truncate">
                          {sale.customer_name || 'Anonyme'}
                        </p>
                        <p className="text-xs text-stone-400">
                          {formatDate(sale.created_at)} · {formatTime(sale.created_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${sale.source === 'site' ? 'bg-blue-100 text-blue-600' : 'bg-stone-100 text-stone-600'}`}>
                          {sale.source === 'site' ? 'Site' : 'Boutique'}
                        </span>
                        <span className="text-sm font-bold text-yellow-600">{formatFCFA(sale.total)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sessions */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-stone-100">
                <h3 className="font-semibold text-stone-700 text-sm">Sessions de travail ({empSessions.length})</h3>
              </div>
              {empSessions.length === 0 ? (
                <p className="p-6 text-stone-400 text-sm text-center">Aucune session ce cycle</p>
              ) : (
                <div className="divide-y divide-stone-50 max-h-48 overflow-y-auto">
                  {empSessions.map(session => (
                    <div key={session.id} className="flex items-center justify-between px-4 py-2.5 gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-stone-700">{formatDate(session.started_at)}</p>
                        <p className="text-xs text-stone-400">
                          {formatTime(session.started_at)}
                          {session.ended_at && ' → ' + formatTime(session.ended_at)}
                        </p>
                      </div>
                      <span className="text-sm font-medium text-stone-600 flex-shrink-0 flex items-center gap-1">
                        <Clock size={12} />
                        {session.duration_minutes
                          ? session.duration_minutes >= 60
                            ? Math.floor(session.duration_minutes / 60) + 'h' + (session.duration_minutes % 60 > 0 ? (session.duration_minutes % 60) + 'm' : '')
                            : session.duration_minutes + 'min'
                          : '—'
                        }
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Modal objectif depuis detail */}
        {editingGoal && (
          <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
            <div className="bg-white rounded-t-2xl sm:rounded-2xl p-5 w-full sm:max-w-sm shadow-xl">
              <h2 className="text-base font-semibold text-stone-800 mb-1">Objectif CA</h2>
              <p className="text-xs text-stone-400 mb-4">{editingGoal.name}</p>
              <label className="block text-xs text-stone-500 mb-1">Montant objectif (FCFA)</label>
              <input type="number" value={goalInput || ''} onChange={e => setGoalInput(Number(e.target.value))}
                placeholder="Ex: 500000" autoFocus
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 mb-4" />
              <div className="flex gap-3">
                <button onClick={handleSaveGoal} disabled={saving}
                  className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
                  {saving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
                <button onClick={() => setEditingGoal(null)}
                  className="px-4 py-2 text-stone-600 hover:bg-stone-100 rounded-lg text-sm">
                  Annuler
                </button>
              </div>
            </div>
          </div>
        )}

        {toast && (
          <div className="fixed bottom-6 right-6 bg-stone-800 text-white text-xs px-4 py-3 rounded-xl shadow-lg z-50 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400" /> {toast}
          </div>
        )}
      </div>
    )
  }

  // VUE LISTE EQUIPE
  return (
    <div className="p-4 lg:p-6">
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-stone-800">Performance Equipe</h1>
        <p className="text-stone-500 text-xs">Cycle actuel — boutique + site · Cliquez sur un membre pour le detail</p>
      </div>

      {/* KPIs globaux */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-xs text-stone-400 mb-1">CA Total Equipe</p>
          <p className="text-lg font-bold text-stone-800">{formatFCFA(totalRevenue)}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-xs text-stone-400 mb-1">Objectif Total</p>
          <p className="text-lg font-bold text-stone-800">{totalGoal > 0 ? formatFCFA(totalGoal) : '—'}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-xs text-stone-400 mb-1">Taux Global</p>
          <p className={`text-lg font-bold ${globalRate >= 100 ? 'text-green-600' : 'text-stone-800'}`}>
            {totalGoal > 0 ? globalRate.toFixed(1) + '%' : '—'}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-xs text-stone-400 mb-1">Ventes Totales</p>
          <p className="text-lg font-bold text-stone-800">{totalSales}</p>
        </div>
      </div>

      {/* Barre progression globale */}
      {totalGoal > 0 && (
        <div className="bg-white rounded-xl p-4 shadow-sm mb-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-stone-700">Progression globale</p>
            <p className="text-sm font-bold">{globalRate.toFixed(1)}%</p>
          </div>
          <div className="w-full bg-stone-100 rounded-full h-2.5">
            <div className={`h-2.5 rounded-full transition-all ${globalRate >= 100 ? 'bg-green-500' : 'bg-yellow-500'}`}
              style={{ width: Math.min(globalRate, 100) + '%' }} />
          </div>
        </div>
      )}

      {/* Liste employés */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-stone-100">
          <h2 className="font-semibold text-stone-700 text-sm">Membres de l&apos;equipe</h2>
        </div>
        {stats.length === 0 ? (
          <div className="p-10 text-center text-stone-400 text-sm">Aucun employe actif</div>
        ) : (
          <div className="divide-y divide-stone-100">
            {stats.map((stat, index) => (
              <div key={stat.employee.id}
                className="px-4 py-4 lg:px-5 cursor-pointer hover:bg-stone-50 transition-colors"
                onClick={() => handleViewDetail(stat)}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 ${
                      index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-stone-400' : 'bg-stone-300'
                    }`}>
                      {stat.employee.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-stone-800 text-sm truncate">{stat.employee.full_name}</p>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        <span className="text-xs text-stone-400 flex items-center gap-0.5">
                          <ShoppingCart size={10} /> {stat.sales}
                        </span>
                        <span className="text-xs text-stone-400 flex items-center gap-0.5">
                          <Globe size={10} /> {stat.orders}
                        </span>
                        <span className="text-xs text-stone-400 flex items-center gap-0.5">
                          <Clock size={10} /> {stat.hoursWorked.toFixed(1)}h
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0 flex-wrap" onClick={e => e.stopPropagation()}>
                    <div className="text-right">
                      <p className="font-bold text-stone-800 text-sm">{formatFCFA(stat.revenue)}</p>
                      <p className="text-xs text-stone-400">{stat.sales + stat.orders} ventes</p>
                    </div>

                    {stat.goal > 0 && (
                      <div className="w-24">
                        <div className="flex justify-between text-xs mb-0.5">
                          <span className="text-stone-400">{stat.rate.toFixed(0)}%</span>
                        </div>
                        <div className="w-full bg-stone-100 rounded-full h-1.5">
                          <div className={`h-1.5 rounded-full ${stat.rate >= 100 ? 'bg-green-500' : 'bg-yellow-500'}`}
                            style={{ width: Math.min(stat.rate, 100) + '%' }} />
                        </div>
                      </div>
                    )}

                    <button
                      onClick={e => {
                        e.stopPropagation()
                        setEditingGoal({ id: stat.employee.id, name: stat.employee.full_name, goalId: stat.goalId })
                        setGoalInput(stat.goal)
                      }}
                      className="text-xs text-yellow-600 border border-yellow-300 hover:bg-yellow-50 px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                    >
                      <Target size={11} className="inline mr-1" />
                      {stat.goal > 0 ? 'Modifier' : 'Objectif'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal objectif */}
      {editingGoal && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl p-5 w-full sm:max-w-sm shadow-xl">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-semibold text-stone-800">Objectif CA</h2>
              <button onClick={() => setEditingGoal(null)}><X size={18} className="text-stone-400" /></button>
            </div>
            <p className="text-xs text-stone-400 mb-4">{editingGoal.name}</p>
            <label className="block text-xs text-stone-500 mb-1">Montant objectif (FCFA)</label>
            <input type="number" value={goalInput || ''} onChange={e => setGoalInput(Number(e.target.value))}
              placeholder="Ex: 500000" autoFocus
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 mb-4" />
            <div className="flex gap-3">
              <button onClick={handleSaveGoal} disabled={saving}
                className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
              <button onClick={() => setEditingGoal(null)}
                className="px-4 py-2 text-stone-600 hover:bg-stone-100 rounded-lg text-sm">
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 bg-stone-800 text-white text-xs px-4 py-3 rounded-xl shadow-lg z-50 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400" /> {toast}
        </div>
      )}
    </div>
  )
}