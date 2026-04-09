'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Target, TrendingUp, Clock, ShoppingCart, Pencil, X } from 'lucide-react'

type Employee = {
  id: string
  full_name: string
  email: string
  role: string
}

type PerformanceGoal = {
  id: string
  employee_id: string
  target_revenue: number
  achieved_revenue: number
  achievement_rate: number
}

type Sale = {
  id: string
  total: number
  status: string
  employee_id: string
}

type WorkSession = {
  id: string
  employee_id: string
  duration_minutes: number
  started_at: string
  ended_at?: string
}

const SHOP_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

export default function PerformancePage() {
  const supabase = createClient()
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null)
  const [allEmployees, setAllEmployees] = useState<Employee[]>([])
  const [goal, setGoal] = useState<PerformanceGoal | null>(null)
  const [sales, setSales] = useState<Sale[]>([])
  const [sessions, setSessions] = useState<WorkSession[]>([])
  const [activeCycleId, setActiveCycleId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showGoalModal, setShowGoalModal] = useState(false)
  const [targetInput, setTargetInput] = useState(0)
  const [saving, setSaving] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null)

  const fetchData = async (employeeId?: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: emp } = await supabase
      .from('employees')
      .select('*')
      .eq('auth_user_id', user.id)
      .single()

    if (!emp) return
    setCurrentEmployee(emp)
    setIsAdmin(emp.role === 'admin')

    const targetEmpId = employeeId || emp.id
    setSelectedEmployeeId(targetEmpId)

    // Cycle actif
    const { data: cycle } = await supabase
      .from('finance_cycles')
      .select('id, started_at')
      .eq('shop_id', SHOP_ID)
      .eq('is_active', true)
      .single()

    if (cycle) {
      setActiveCycleId(cycle.id)

      // Objectif
      const { data: goalData } = await supabase
        .from('performance_goals')
        .select('*')
        .eq('employee_id', targetEmpId)
        .eq('cycle_id', cycle.id)
        .single()

      // Ventes de l'employé
      const { data: salesData } = await supabase
        .from('sales')
        .select('id, total, status, employee_id')
        .eq('shop_id', SHOP_ID)
        .eq('employee_id', targetEmpId)
        .gte('created_at', cycle.started_at)

      const paidSales = salesData?.filter(s => s.status === 'paid') || []
      const achievedRevenue = paidSales.reduce((sum, s) => sum + s.total, 0)

      if (goalData) {
        const rate = goalData.target_revenue > 0
          ? (achievedRevenue / goalData.target_revenue) * 100
          : 0

        await supabase
          .from('performance_goals')
          .update({ achieved_revenue: achievedRevenue, achievement_rate: rate })
          .eq('id', goalData.id)

        setGoal({ ...goalData, achieved_revenue: achievedRevenue, achievement_rate: rate })
        setTargetInput(goalData.target_revenue)
      }

      setSales(salesData || [])
    }

    // Sessions de travail
    const { data: sessionsData } = await supabase
      .from('work_sessions')
      .select('*')
      .eq('employee_id', targetEmpId)
      .order('started_at', { ascending: false })

    setSessions(sessionsData || [])

    // Tous les employés si admin
    if (emp.role === 'admin') {
      const { data: allEmps } = await supabase
        .from('employees')
        .select('*')
        .eq('shop_id', SHOP_ID)
        .eq('is_active', true)
      setAllEmployees(allEmps || [])
    }

    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const handleSaveGoal = async () => {
    if (!activeCycleId || !selectedEmployeeId) return
    setSaving(true)

    if (goal) {
      await supabase
        .from('performance_goals')
        .update({ target_revenue: targetInput, updated_at: new Date().toISOString() })
        .eq('id', goal.id)
    } else {
      await supabase
        .from('performance_goals')
        .insert({
          employee_id: selectedEmployeeId,
          shop_id: SHOP_ID,
          cycle_id: activeCycleId,
          target_revenue: targetInput,
          achieved_revenue: 0,
          achievement_rate: 0,
        })
    }

    setSaving(false)
    setShowGoalModal(false)
    fetchData(selectedEmployeeId)
  }

  const formatFCFA = (amount: number) =>
    new Intl.NumberFormat('fr-FR').format(Math.round(amount)) + ' FCFA'

  const totalHours = sessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0) / 60
  const paidSales = sales.filter(s => s.status === 'paid')
  const totalSales = sales.length
  const conversionRate = totalSales > 0 ? (paidSales.length / totalSales) * 100 : 0
  const avgSale = paidSales.length > 0
    ? paidSales.reduce((sum, s) => sum + s.total, 0) / paidSales.length
    : 0

  if (loading) return <div className="p-6 text-stone-400">Chargement...</div>

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-stone-800">
            {isAdmin ? 'Performance de l\'Équipe' : 'Ma Performance'}
          </h1>
          <p className="text-stone-500 text-sm">Vos indicateurs de performance</p>
        </div>

        {isAdmin && (
          <select
            onChange={(e) => fetchData(e.target.value)}
            className="border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
          >
            {allEmployees.map(emp => (
              <option key={emp.id} value={emp.id}>{emp.full_name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Objectif CA */}
      <div className="bg-white rounded-xl p-5 shadow-sm mb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Target size={18} className="text-yellow-600" />
            <h2 className="font-semibold text-stone-700">Objectif de CA</h2>
          </div>
          <button
            onClick={() => setShowGoalModal(true)}
            className="flex items-center gap-1 text-xs text-yellow-600 hover:text-yellow-700 font-medium"
          >
            <Pencil size={12} /> Modifier
          </button>
        </div>

        {goal ? (
          <>
            <div className="flex items-end justify-between mb-2">
              <div>
                <p className="text-xs text-stone-400">Objectif fixé</p>
                <p className="text-2xl font-bold text-stone-800">{formatFCFA(goal.target_revenue)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-stone-400">CA atteint</p>
                <p className="text-2xl font-bold text-yellow-600">{formatFCFA(goal.achieved_revenue)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-stone-400">Taux de réalisation</p>
                <p className={`text-2xl font-bold ${goal.achievement_rate >= 100 ? 'text-green-600' : 'text-stone-800'}`}>
                  {goal.achievement_rate.toFixed(1)}%
                </p>
              </div>
            </div>

            {/* Barre de progression */}
            <div className="w-full bg-stone-100 rounded-full h-3 mb-2">
              <div
                className={`h-3 rounded-full transition-all ${goal.achievement_rate >= 100 ? 'bg-green-500' : 'bg-yellow-500'}`}
                style={{ width: `${Math.min(goal.achievement_rate, 100)}%` }}
              />
            </div>

            {goal.achievement_rate >= 100 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                <p className="text-green-600 font-medium text-sm">🎉 Objectif Atteint !</p>
                <p className="text-green-500 text-xs">Félicitations ! Vous avez dépassé votre objectif.</p>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-4">
            <p className="text-stone-400 text-sm mb-2">Aucun objectif défini pour ce cycle</p>
            <button
              onClick={() => setShowGoalModal(true)}
              className="text-yellow-600 hover:text-yellow-700 text-sm font-medium"
            >
              Définir un objectif
            </button>
          </div>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <ShoppingCart size={16} className="text-stone-400" />
            <p className="text-sm text-stone-500">CA Généré</p>
          </div>
          <p className="text-2xl font-bold text-stone-800">
            {formatFCFA(paidSales.reduce((sum, s) => sum + s.total, 0))}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={16} className="text-stone-400" />
            <p className="text-sm text-stone-500">Ventes Réussies</p>
          </div>
          <p className="text-2xl font-bold text-stone-800">{paidSales.length}</p>
          <p className="text-xs text-stone-400">sur {totalSales} total</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Target size={16} className="text-stone-400" />
            <p className="text-sm text-stone-500">Taux de Transformation</p>
          </div>
          <p className="text-2xl font-bold text-stone-800">{conversionRate.toFixed(1)}%</p>
        </div>
      </div>

      {/* Discipline & Résumé */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={16} className="text-stone-400" />
            <h2 className="font-semibold text-stone-700">Discipline</h2>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-stone-400">Sessions de travail</p>
              <p className="text-xl font-bold text-stone-800">{sessions.length}</p>
            </div>
            <div>
              <p className="text-xs text-stone-400">Heures travaillées</p>
              <p className="text-xl font-bold text-stone-800">{totalHours.toFixed(2)}h</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm">
          <h2 className="font-semibold text-stone-700 mb-4">Résumé</h2>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-stone-400">Ventes totales</span>
              <span className="font-medium text-stone-800">{totalSales}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-stone-400">Ventes payées</span>
              <span className="font-medium text-stone-800">{paidSales.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-stone-400">CA moyen/vente</span>
              <span className="font-medium text-stone-800">{formatFCFA(avgSale)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Modal objectif */}
      {showGoalModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-stone-800">Définir l'objectif CA</h2>
              <button onClick={() => setShowGoalModal(false)}>
                <X size={18} className="text-stone-400" />
              </button>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Objectif de CA (FCFA)
              </label>
              <input
                type="number"
                value={targetInput}
                onChange={(e) => setTargetInput(Number(e.target.value))}
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
            </div>
            <div className="flex gap-3 mt-4">
              <button
                onClick={handleSaveGoal}
                disabled={saving}
                className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
              <button
                onClick={() => setShowGoalModal(false)}
                className="px-4 py-2 text-stone-600 hover:bg-stone-100 rounded-lg text-sm"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}