'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Users, TrendingUp } from 'lucide-react'

type Employee = {
  id: string
  full_name: string
  email: string
  role: string
}

type EmployeeStats = {
  employee: Employee
  revenue: number
  sales: number
  goal?: number
  rate: number
}

const SHOP_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

export default function EquipePage() {
  const supabase = createClient()
  const [stats, setStats] = useState<EmployeeStats[]>([])
  const [totalRevenue, setTotalRevenue] = useState(0)
  const [totalGoal, setTotalGoal] = useState(0)
  const [totalSales, setTotalSales] = useState(0)
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    const { data: employees } = await supabase
      .from('employees')
      .select('*')
      .eq('shop_id', SHOP_ID)
      .eq('is_active', true)

    const { data: cycle } = await supabase
      .from('finance_cycles')
      .select('id, started_at')
      .eq('shop_id', SHOP_ID)
      .eq('is_active', true)
      .single()

    if (!employees || !cycle) {
      setLoading(false)
      return
    }

    const { data: sales } = await supabase
      .from('sales')
      .select('id, total, status, employee_id')
      .eq('shop_id', SHOP_ID)
      .eq('status', 'paid')
      .gte('created_at', cycle.started_at)

    const { data: goals } = await supabase
      .from('performance_goals')
      .select('*')
      .eq('cycle_id', cycle.id)

    const employeeStats: EmployeeStats[] = employees.map(emp => {
      const empSales = sales?.filter(s => s.employee_id === emp.id) || []
      const revenue = empSales.reduce((sum, s) => sum + s.total, 0)
      const goal = goals?.find(g => g.employee_id === emp.id)
      const rate = goal?.target_revenue > 0 ? (revenue / goal.target_revenue) * 100 : 0

      return {
        employee: emp,
        revenue,
        sales: empSales.length,
        goal: goal?.target_revenue,
        rate,
      }
    })

    employeeStats.sort((a, b) => b.revenue - a.revenue)

    const total = employeeStats.reduce((sum, s) => sum + s.revenue, 0)
    const totalG = goals?.reduce((sum, g) => sum + g.target_revenue, 0) || 0
    const totalS = sales?.length || 0

    setStats(employeeStats)
    setTotalRevenue(total)
    setTotalGoal(totalG)
    setTotalSales(totalS)
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const formatFCFA = (amount: number) =>
    new Intl.NumberFormat('fr-FR').format(Math.round(amount)) + ' FCFA'

  const globalRate = totalGoal > 0 ? (totalRevenue / totalGoal) * 100 : 0

  if (loading) return <div className="p-6 text-stone-400">Chargement...</div>

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-stone-800">Performance de l'Équipe</h1>
        <p className="text-stone-500 text-sm">Vue d'ensemble et gestion des objectifs</p>
      </div>

      {/* KPIs équipe */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-xs text-stone-400 mb-1">CA Total Équipe</p>
          <p className="text-xl font-bold text-stone-800">{formatFCFA(totalRevenue)}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-xs text-stone-400 mb-1">Objectif Total</p>
          <p className="text-xl font-bold text-stone-800">{formatFCFA(totalGoal)}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-xs text-stone-400 mb-1">Taux Global</p>
          <p className={`text-xl font-bold ${globalRate >= 100 ? 'text-green-600' : 'text-stone-800'}`}>
            {globalRate.toFixed(1)}%
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-xs text-stone-400 mb-1">Ventes Totales</p>
          <p className="text-xl font-bold text-stone-800">{totalSales}</p>
        </div>
      </div>

      {/* Barre progression globale */}
      <div className="bg-white rounded-xl p-5 shadow-sm mb-6">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-stone-700">Progression globale de l'équipe</p>
          <p className="text-sm font-bold text-stone-800">{globalRate.toFixed(1)}%</p>
        </div>
        <div className="w-full bg-stone-100 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all ${globalRate >= 100 ? 'bg-green-500' : 'bg-yellow-500'}`}
            style={{ width: `${Math.min(globalRate, 100)}%` }}
          />
        </div>
      </div>

      {/* Liste employés */}
      <div className="bg-white rounded-xl shadow-sm">
        <div className="px-5 py-4 border-b border-stone-100">
          <h2 className="font-semibold text-stone-700">Performance individuelle</h2>
        </div>
        <div className="divide-y divide-stone-100">
          {stats.map((stat, index) => (
            <div key={stat.employee.id} className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                  index === 0 ? 'bg-yellow-500' :
                  index === 1 ? 'bg-stone-400' :
                  'bg-stone-300'
                }`}>
                  {stat.employee.full_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium text-stone-800">{stat.employee.full_name}</p>
                  <p className="text-xs text-stone-400">{stat.employee.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-8">
                <div className="text-right">
                  <p className="font-bold text-stone-800">{formatFCFA(stat.revenue)}</p>
                  <p className="text-xs text-stone-400">{stat.sales} ventes</p>
                </div>
                {stat.goal && (
                  <div className="text-right w-32">
                    <div className="w-full bg-stone-100 rounded-full h-2 mb-1">
                      <div
                        className={`h-2 rounded-full ${stat.rate >= 100 ? 'bg-green-500' : 'bg-yellow-500'}`}
                        style={{ width: `${Math.min(stat.rate, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-stone-400">{stat.rate.toFixed(1)}% de l'objectif</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}