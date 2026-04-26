'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Target, ShoppingCart, Globe } from 'lucide-react'

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
}

const SHOP_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

export default function EquipePage() {
  const supabase = createClient()
  const [stats, setStats] = useState<EmployeeStats[]>([])
  const [totalRevenue, setTotalRevenue] = useState(0)
  const [totalSales, setTotalSales] = useState(0)
  const [cycleId, setCycleId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [editingGoal, setEditingGoal] = useState<{ id: string; name: string; goalId: string | null } | null>(null)
  const [goalInput, setGoalInput] = useState(0)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  const fetchData = async () => {
    setLoading(true)

    // 1. Employees
    const { data: employees } = await supabase
      .from('employees')
      .select('*')
      .eq('shop_id', SHOP_ID)
      .eq('is_active', true)

    if (!employees || employees.length === 0) { setLoading(false); return }

    // 2. Cycle actif
    const { data: cycleData } = await supabase
      .from('finance_cycles')
      .select('id, created_at, start_date')
      .eq('shop_id', SHOP_ID)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    const activeCycleId = cycleData?.id || null
    setCycleId(activeCycleId)

    const startISO = cycleData?.created_at
      ? new Date(cycleData.created_at).toISOString()
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

    // 3. Ventes boutique payées
    const { data: sales } = await supabase
      .from('sales')
      .select('id, total, employee_id')
      .eq('shop_id', SHOP_ID)
      .eq('status', 'paid')
      .gte('created_at', startISO)

    // 4. Commandes site livrées
    const { data: orders } = await supabase
      .from('orders')
      .select('id, total, auth_user_id')
      .eq('shop_id', SHOP_ID)
      .eq('status', 'livré')
      .gte('created_at', startISO)

    // 5. Objectifs du cycle actif
    let goals: any[] = []
    if (activeCycleId) {
      const { data: goalsData } = await supabase
        .from('performance_goals')
        .select('*')
        .eq('shop_id', SHOP_ID)
        .eq('cycle_id', activeCycleId)
      goals = goalsData || []
    }

    // 6. Calculer stats par employé
    const employeeStats: EmployeeStats[] = employees.map(emp => {
      const empSales = sales?.filter(s => s.employee_id === emp.id) || []
      const salesRevenue = empSales.reduce((sum, s) => sum + (s.total || 0), 0)

      const empOrders = emp.auth_user_id
        ? (orders?.filter(o => o.auth_user_id === emp.auth_user_id) || [])
        : []
      const ordersRevenue = empOrders.reduce((sum, o) => sum + (o.total || 0), 0)

      const totalRev = salesRevenue + ordersRevenue
      const goalObj = goals.find(g => g.employee_id === emp.id)
      const goal = goalObj?.target_revenue || 0
      const rate = goal > 0 ? (totalRev / goal) * 100 : 0

      return {
        employee: emp,
        revenue: totalRev,
        sales: empSales.length,
        orders: empOrders.length,
        goal,
        goalId: goalObj?.id || null,
        rate,
      }
    })

    employeeStats.sort((a, b) => b.revenue - a.revenue)

    setStats(employeeStats)
    setTotalRevenue(employeeStats.reduce((sum, s) => sum + s.revenue, 0))
    setTotalSales((sales?.length || 0) + (orders?.length || 0))
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const handleSaveGoal = async () => {
    if (!editingGoal || !cycleId) {
      showToast('Aucun cycle actif — creez un cycle dans Finance')
      return
    }
    setSaving(true)

    if (editingGoal.goalId) {
      // Update
      await supabase
        .from('performance_goals')
        .update({
          target_revenue: goalInput,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingGoal.goalId)
    } else {
      // Insert
      await supabase
        .from('performance_goals')
        .insert({
          shop_id: SHOP_ID,
          employee_id: editingGoal.id,
          cycle_id: cycleId,
          target_revenue: goalInput,
          achieved_revenue: 0,
          achievement_rate: 0,
        })
    }

    setSaving(false)
    setEditingGoal(null)
    showToast('Objectif enregistre')
    fetchData()
  }

  const formatFCFA = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA'

  const totalGoal = stats.reduce((sum, s) => sum + s.goal, 0)
  const globalRate = totalGoal > 0 ? (totalRevenue / totalGoal) * 100 : 0

  if (loading) return <div className="p-6 text-stone-400 text-sm">Chargement...</div>

  return (
    <div className="p-4 lg:p-6">
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-stone-800">Performance Equipe</h1>
        <p className="text-stone-500 text-xs">
          Cycle actuel — boutique + site
          {!cycleId && <span className="ml-2 text-red-400">⚠ Aucun cycle actif</span>}
        </p>
      </div>

      {/* KPIs */}
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
            <p className="text-sm font-bold text-stone-800">{globalRate.toFixed(1)}%</p>
          </div>
          <div className="w-full bg-stone-100 rounded-full h-2.5">
            <div
              className={`h-2.5 rounded-full transition-all ${globalRate >= 100 ? 'bg-green-500' : 'bg-yellow-500'}`}
              style={{ width: Math.min(globalRate, 100) + '%' }}
            />
          </div>
        </div>
      )}

      {/* Liste employés */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-stone-100">
          <h2 className="font-semibold text-stone-700 text-sm">Performance individuelle</h2>
        </div>

        {stats.length === 0 ? (
          <div className="p-10 text-center text-stone-400 text-sm">Aucun employe actif</div>
        ) : (
          <div className="divide-y divide-stone-100">
            {stats.map((stat, index) => (
              <div key={stat.employee.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  {/* Identité */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 ${
                      index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-stone-400' : 'bg-stone-300'
                    }`}>
                      {stat.employee.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-stone-800 text-sm truncate">{stat.employee.full_name}</p>
                      <p className="text-xs text-stone-400 truncate">{stat.employee.email}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-stone-400 flex items-center gap-0.5">
                          <ShoppingCart size={10} /> {stat.sales} boutique
                        </span>
                        <span className="text-xs text-stone-400 flex items-center gap-0.5">
                          <Globe size={10} /> {stat.orders} site
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Stats droite */}
                  <div className="flex items-center gap-3 flex-shrink-0 flex-wrap">
                    <div className="text-right">
                      <p className="font-bold text-stone-800 text-sm">{formatFCFA(stat.revenue)}</p>
                      <p className="text-xs text-stone-400">{stat.sales + stat.orders} total</p>
                    </div>

                    {/* Barre objectif */}
                    {stat.goal > 0 && (
                      <div className="w-28">
                        <div className="flex justify-between text-xs mb-0.5">
                          <span className="text-stone-400 truncate">{formatFCFA(stat.goal)}</span>
                          <span className={stat.rate >= 100 ? 'text-green-600 font-bold' : 'text-stone-500'}>
                            {stat.rate.toFixed(0)}%
                          </span>
                        </div>
                        <div className="w-full bg-stone-100 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${stat.rate >= 100 ? 'bg-green-500' : 'bg-yellow-500'}`}
                            style={{ width: Math.min(stat.rate, 100) + '%' }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Bouton objectif */}
                    <button
                      onClick={() => {
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
            <h2 className="text-base font-semibold text-stone-800 mb-1">Objectif CA</h2>
            <p className="text-xs text-stone-400 mb-4">{editingGoal.name}</p>

            {!cycleId && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-xs text-red-600">
                Aucun cycle actif. Creez un cycle dans la page Finance avant de definir des objectifs.
              </div>
            )}

            <label className="block text-xs text-stone-500 mb-1">Objectif mensuel (FCFA)</label>
            <input
              type="number"
              value={goalInput || ''}
              onChange={e => setGoalInput(Number(e.target.value))}
              placeholder="Ex: 500000"
              disabled={!cycleId}
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 mb-4 disabled:opacity-50"
            />
            <div className="flex gap-3">
              <button
                onClick={handleSaveGoal}
                disabled={saving || !cycleId}
                className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
              <button
                onClick={() => setEditingGoal(null)}
                className="px-4 py-2 text-stone-600 hover:bg-stone-100 rounded-lg text-sm"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-stone-800 text-white text-xs px-4 py-3 rounded-xl shadow-lg z-50 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400" />
          {toast}
        </div>
      )}
    </div>
  )
}