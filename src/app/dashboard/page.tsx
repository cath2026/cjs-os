'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import {
  ShoppingCart,
  Users,
  Package,
  DollarSign,
  TrendingUp,
  Plus,
  UserPlus,
} from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function DashboardPage() {
  const supabase = createClient()
  const router = useRouter()
  const [employeeName, setEmployeeName] = useState('')
  const [stats, setStats] = useState({
    totalSales: 0,
    paidSales: 0,
    totalCustomers: 0,
    totalProducts: 0,
    grossRevenue: 0,
    netRevenue: 0,
    grossMargin: 0,
    netMargin: 0,
    fixedCosts: 0,
  })
  const [topProducts, setTopProducts] = useState<{ name: string; total: number }[]>([])
  const [topCustomers, setTopCustomers] = useState<{ full_name: string; total_spent: number }[]>([])
  const [salesBySource, setSalesBySource] = useState<{ source: string; count: number }[]>([])
  const [loading, setLoading] = useState(true)
  const SHOP_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: emp } = await supabase
          .from('employees')
          .select('full_name')
          .eq('auth_user_id', user.id)
          .single()
        if (emp) setEmployeeName(emp.full_name)

        const { data: sales } = await supabase
          .from('sales')
          .select('id, status, total, subtotal, acquisition_source')
          .eq('shop_id', SHOP_ID)

        const { data: customers } = await supabase
          .from('customers')
          .select('id, full_name, total_spent')
          .eq('shop_id', SHOP_ID)
          .order('total_spent', { ascending: false })
          .limit(5)

        const { data: products } = await supabase
          .from('products')
          .select('id')
          .eq('shop_id', SHOP_ID)
          .eq('is_active', true)

        const { data: saleItems } = await supabase
          .from('sale_items')
          .select('product_name, quantity, unit_price, unit_cost, sale_id')

        const paidSales = sales?.filter(s => s.status === 'paid') || []
        const grossRevenue = paidSales.reduce((sum, s) => sum + s.subtotal, 0)
        const netRevenue = paidSales.reduce((sum, s) => sum + s.total, 0)

        const paidSaleIds = paidSales.map(s => s.id)
        const paidItems = saleItems?.filter(i => paidSaleIds.includes(i.sale_id)) || []
        const grossMargin = paidItems.reduce(
          (sum, i) => sum + (i.unit_price - i.unit_cost) * i.quantity, 0
        )

        // Top produits
        const productTotals: Record<string, number> = {}
        paidItems.forEach(i => {
          productTotals[i.product_name] = (productTotals[i.product_name] || 0) + i.unit_price * i.quantity
        })
        const topProds = Object.entries(productTotals)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, total]) => ({ name, total }))
        setTopProducts(topProds)

        // Top clients
        setTopCustomers(customers || [])

        // Ventes par source
        const sourceCounts: Record<string, number> = {}
        paidSales.forEach(s => {
          if (s.acquisition_source) {
            sourceCounts[s.acquisition_source] = (sourceCounts[s.acquisition_source] || 0) + 1
          }
        })
        const sourceData = Object.entries(sourceCounts)
          .sort((a, b) => b[1] - a[1])
          .map(([source, count]) => ({ source, count }))
        setSalesBySource(sourceData)

        setStats({
          totalSales: sales?.length || 0,
          paidSales: paidSales.length,
          totalCustomers: customers?.length || 0,
          totalProducts: products?.length || 0,
          grossRevenue,
          netRevenue,
          grossMargin,
          netMargin: grossMargin,
          fixedCosts: 0,
        })
      } catch (error) {
        console.error(error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const formatFCFA = (amount: number) =>
    new Intl.NumberFormat('fr-FR').format(Math.round(amount)) + ' FCFA'

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-stone-800">Dashboard</h1>
          <p className="text-stone-500 text-sm">Bienvenue, {employeeName}</p>
        </div>
        <button
          onClick={() => router.push('/dashboard/sessions')}
          className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Démarrer session
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-stone-400">Chargement...</p>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-stone-500">Ventes</p>
                <ShoppingCart size={18} className="text-stone-400" />
              </div>
              <p className="text-2xl font-bold text-stone-800">{stats.totalSales}</p>
              <p className="text-xs text-stone-400">{stats.paidSales} payées</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-stone-500">Clients</p>
                <Users size={18} className="text-stone-400" />
              </div>
              <p className="text-2xl font-bold text-stone-800">{stats.totalCustomers}</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-stone-500">Produits</p>
                <Package size={18} className="text-stone-400" />
              </div>
              <p className="text-2xl font-bold text-stone-800">{stats.totalProducts}</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-stone-500">CA Net</p>
                <DollarSign size={18} className="text-stone-400" />
              </div>
              <p className="text-2xl font-bold text-stone-800">
                {formatFCFA(stats.netRevenue)}
              </p>
            </div>
          </div>

          {/* Aperçu financier */}
          <div className="bg-white rounded-xl p-5 shadow-sm mb-6">
            <h2 className="text-base font-semibold text-stone-700 mb-4">Aperçu financier</h2>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-stone-400 mb-1">CA Brut</p>
                <p className="text-lg font-bold text-stone-800">{formatFCFA(stats.grossRevenue)}</p>
              </div>
              <div>
                <p className="text-xs text-stone-400 mb-1">Marge Brute</p>
                <p className="text-lg font-bold text-stone-800">{formatFCFA(stats.grossMargin)}</p>
              </div>
              <div>
                <p className="text-xs text-stone-400 mb-1">Charges Fixes</p>
                <p className="text-lg font-bold text-stone-800">{formatFCFA(stats.fixedCosts)}</p>
              </div>
              <div>
                <p className="text-xs text-stone-400 mb-1">Marge Nette</p>
                <p className={`text-lg font-bold ${stats.netMargin >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {formatFCFA(stats.netMargin)}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            {/* Actions rapides */}
            <div className="bg-white rounded-xl p-5 shadow-sm">
              <h2 className="text-base font-semibold text-stone-700 mb-3">Actions rapides</h2>
              <div className="space-y-2">
                <button
                  onClick={() => router.push('/dashboard/ventes/nouvelle')}
                  className="w-full flex items-center justify-center gap-2 bg-yellow-600 hover:bg-yellow-700 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
                >
                  <Plus size={16} />
                  Nouvelle vente
                </button>
                <button
                  onClick={() => router.push('/dashboard/clients')}
                  className="w-full flex items-center justify-center gap-2 border border-stone-300 hover:bg-stone-50 text-stone-700 py-2.5 rounded-lg text-sm font-medium transition-colors"
                >
                  <UserPlus size={16} />
                  Ajouter client
                </button>
              </div>
            </div>

            {/* Liens utiles */}
            <div className="bg-white rounded-xl p-5 shadow-sm">
              <h2 className="text-base font-semibold text-stone-700 mb-3">Liens utiles</h2>
              <div className="space-y-2">
                <button
                  onClick={() => router.push('/dashboard/performance')}
                  className="w-full text-left flex items-center gap-2 text-sm text-stone-600 hover:text-yellow-700 py-1.5 transition-colors"
                >
                  <TrendingUp size={15} />
                  Voir mes performances
                </button>
                <button
                  onClick={() => router.push('/dashboard/logs')}
                  className="w-full text-left flex items-center gap-2 text-sm text-stone-600 hover:text-yellow-700 py-1.5 transition-colors"
                >
                  <Package size={15} />
                  Historique des actions
                </button>
              </div>
            </div>
          </div>

          {/* Top produits + Top clients */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            {/* Top 5 produits */}
            <div className="bg-white rounded-xl p-5 shadow-sm">
              <h2 className="text-base font-semibold text-stone-700 mb-3">Top 5 produits</h2>
              {topProducts.length === 0 ? (
                <p className="text-stone-400 text-sm">Aucune vente enregistrée</p>
              ) : (
                <div className="space-y-2">
                  {topProducts.map((p, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-yellow-100 text-yellow-700 text-xs flex items-center justify-center font-bold">
                          {i + 1}
                        </span>
                        <span className="text-sm text-stone-700">{p.name}</span>
                      </div>
                      <span className="text-sm font-medium text-stone-800">{formatFCFA(p.total)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top 5 clients */}
            <div className="bg-white rounded-xl p-5 shadow-sm">
              <h2 className="text-base font-semibold text-stone-700 mb-3">Top 5 clients</h2>
              {topCustomers.length === 0 ? (
                <p className="text-stone-400 text-sm">Aucun client enregistré</p>
              ) : (
                <div className="space-y-2">
                  {topCustomers.map((c, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`w-5 h-5 rounded-full text-white text-xs flex items-center justify-center font-bold ${
                          i === 0 ? 'bg-yellow-500' : i === 1 ? 'bg-stone-400' : 'bg-stone-300'
                        }`}>
                          {i + 1}
                        </span>
                        <span className="text-sm text-stone-700">{c.full_name}</span>
                      </div>
                      <span className="text-sm font-medium text-stone-800">{formatFCFA(c.total_spent)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Ventes par source */}
          {salesBySource.length > 0 && (
            <div className="bg-white rounded-xl p-5 shadow-sm">
              <h2 className="text-base font-semibold text-stone-700 mb-3">Ventes par source</h2>
              <div className="flex gap-3 flex-wrap">
                {salesBySource.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 bg-stone-50 rounded-lg px-3 py-2">
                    <span className="text-sm font-medium text-stone-700">{s.source}</span>
                    <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                      {s.count} vente{s.count > 1 ? 's' : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}