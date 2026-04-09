'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Pencil, X, Lock } from 'lucide-react'

type Cycle = {
  id: string
  started_at: string
  closed_at?: string
  is_active: boolean
  total_sales: number
  gross_revenue: number
  net_revenue: number
  gross_margin: number
  net_margin: number
  fixed_costs_total: number
}

type FixedCosts = {
  id: string
  salary: number
  bonus: number
  commission: number
  invoices: number
  internet: number
  unexpected: number
  other: number
  total: number
}

type DistributionRules = {
  id: string
  reinvestment_pct: number
  marketing_pct: number
  savings_pct: number
  owner_pct: number
  tithe_pct: number
  unexpected_pct: number
}

const SHOP_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

export default function FinancePage() {
  const supabase = createClient()
  const [activeCycle, setActiveCycle] = useState<Cycle | null>(null)
  const [closedCycles, setClosedCycles] = useState<Cycle[]>([])
  const [fixedCosts, setFixedCosts] = useState<FixedCosts | null>(null)
  const [distribution, setDistribution] = useState<DistributionRules | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCostsModal, setShowCostsModal] = useState(false)
  const [showDistribModal, setShowDistribModal] = useState(false)
  const [showCloseModal, setShowCloseModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [costsForm, setCostsForm] = useState({
    salary: 0, bonus: 0, commission: 0,
    invoices: 0, internet: 0, unexpected: 0, other: 0
  })

  const [distribForm, setDistribForm] = useState({
    reinvestment_pct: 30, marketing_pct: 30,
    savings_pct: 15, owner_pct: 5,
    tithe_pct: 10, unexpected_pct: 10
  })

  const fetchData = async () => {
    // Cycle actif
    const { data: cycle } = await supabase
      .from('finance_cycles')
      .select('*')
      .eq('shop_id', SHOP_ID)
      .eq('is_active', true)
      .single()

    // Cycles clôturés
    const { data: closed } = await supabase
      .from('finance_cycles')
      .select('*')
      .eq('shop_id', SHOP_ID)
      .eq('is_active', false)
      .order('closed_at', { ascending: false })
    setClosedCycles(closed || [])

    // Règles de répartition
    const { data: dist } = await supabase
      .from('distribution_rules')
      .select('*')
      .eq('shop_id', SHOP_ID)
      .single()
    if (dist) {
      setDistribution(dist)
      setDistribForm({
        reinvestment_pct: dist.reinvestment_pct,
        marketing_pct: dist.marketing_pct,
        savings_pct: dist.savings_pct,
        owner_pct: dist.owner_pct,
        tithe_pct: dist.tithe_pct,
        unexpected_pct: dist.unexpected_pct,
      })
    }

    if (!cycle) {
      setLoading(false)
      return
    }

    // Charges fixes du cycle
    const { data: costsData } = await supabase
      .from('fixed_costs')
      .select('*')
      .eq('cycle_id', cycle.id)
      .single()

    if (costsData) {
      setFixedCosts(costsData)
      setCostsForm({
        salary: costsData.salary,
        bonus: costsData.bonus,
        commission: costsData.commission,
        invoices: costsData.invoices,
        internet: costsData.internet,
        unexpected: costsData.unexpected,
        other: costsData.other,
      })
    }

    // Ventes payées du cycle
    const { data: sales } = await supabase
      .from('sales')
      .select('*, sale_items(*)')
      .eq('shop_id', SHOP_ID)
      .eq('status', 'paid')
      .gte('created_at', cycle.started_at)

    const grossRevenue = sales?.reduce((sum, s) => sum + s.subtotal, 0) || 0
    const netRevenue = sales?.reduce((sum, s) => sum + s.total, 0) || 0
    const allItems = sales?.flatMap((s: any) => s.sale_items) || []
    const grossMargin = allItems.reduce(
      (sum: number, i: any) => sum + (i.unit_price - i.unit_cost) * i.quantity, 0
    )
    const totalFixedCosts = costsData?.total || 0
    const netMargin = grossMargin - totalFixedCosts

    // Mise à jour cycle
    await supabase
      .from('finance_cycles')
      .update({
        total_sales: sales?.length || 0,
        gross_revenue: grossRevenue,
        net_revenue: netRevenue,
        gross_margin: grossMargin,
        net_margin: netMargin,
        fixed_costs_total: totalFixedCosts,
      })
      .eq('id', cycle.id)

    setActiveCycle({
      ...cycle,
      total_sales: sales?.length || 0,
      gross_revenue: grossRevenue,
      net_revenue: netRevenue,
      gross_margin: grossMargin,
      net_margin: netMargin,
      fixed_costs_total: totalFixedCosts,
    })

    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const handleSaveCosts = async () => {
    if (!activeCycle) return
    setSaving(true)

    if (fixedCosts) {
      await supabase
        .from('fixed_costs')
        .update({ ...costsForm, updated_at: new Date().toISOString() })
        .eq('id', fixedCosts.id)
    } else {
      await supabase
        .from('fixed_costs')
        .insert({ shop_id: SHOP_ID, cycle_id: activeCycle.id, ...costsForm })
    }

    setSaving(false)
    setShowCostsModal(false)
    fetchData()
  }

  const handleSaveDistrib = async () => {
    const total = Object.values(distribForm).reduce((sum, v) => sum + v, 0)
    if (total !== 100) {
      setError(`Total doit être 100% (actuellement ${total}%)`)
      return
    }
    setSaving(true)
    setError('')

    await supabase
      .from('distribution_rules')
      .update({ ...distribForm, updated_at: new Date().toISOString() })
      .eq('id', distribution?.id)

    setSaving(false)
    setShowDistribModal(false)
    fetchData()
  }

  const handleCloseCycle = async () => {
    if (!activeCycle) return
    setSaving(true)

    await supabase
      .from('finance_cycles')
      .update({ is_active: false, closed_at: new Date().toISOString() })
      .eq('id', activeCycle.id)

    await supabase
      .from('finance_cycles')
      .insert({ shop_id: SHOP_ID, started_at: new Date().toISOString(), is_active: true })

    await supabase.from('logs').insert({
      shop_id: SHOP_ID,
      action: 'Clôture cycle finance',
      module: 'finance',
      reference_id: activeCycle.id,
    })

    setSaving(false)
    setShowCloseModal(false)
    fetchData()
  }

  const formatFCFA = (amount: number) =>
    new Intl.NumberFormat('fr-FR').format(Math.round(amount)) + ' FCFA'

  const netMargin = activeCycle?.net_margin || 0
  const distribAmount = (pct: number) => netMargin > 0 ? (netMargin * pct) / 100 : 0

  if (loading) return <div className="p-6 text-stone-400">Chargement...</div>

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-stone-800">Finance</h1>
          <p className="text-stone-500 text-sm">Vue d'ensemble financière — Douala, Cameroun (FCFA)</p>
        </div>
        <button
          onClick={() => setShowCloseModal(true)}
          className="flex items-center gap-2 border border-stone-300 hover:bg-stone-50 text-stone-600 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Lock size={14} />
          Clôturer cycle
        </button>
      </div>

      {/* Cycle actif */}
      {activeCycle && (
        <div className="bg-white rounded-xl p-5 shadow-sm mb-4">
          <div className="mb-4">
            <span className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full font-medium">
              Cycle Actuel
            </span>
            <p className="font-semibold text-stone-800 mt-1">
              Depuis le {new Date(activeCycle.started_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            <p className="text-xs text-stone-400">
              Ventes du cycle : {activeCycle.total_sales}
            </p>
          </div>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-stone-400 mb-1">CA Brut</p>
              <p className="text-xl font-bold text-stone-800">{formatFCFA(activeCycle.gross_revenue)}</p>
            </div>
            <div>
              <p className="text-xs text-stone-400 mb-1">CA Net</p>
              <p className="text-xl font-bold text-stone-800">{formatFCFA(activeCycle.net_revenue)}</p>
              <p className="text-xs text-red-400">
                Réductions: {formatFCFA(activeCycle.gross_revenue - activeCycle.net_revenue)}
              </p>
            </div>
            <div>
              <p className="text-xs text-stone-400 mb-1">Marge Brute</p>
              <p className="text-xl font-bold text-stone-800">{formatFCFA(activeCycle.gross_margin)}</p>
            </div>
            <div>
              <p className="text-xs text-stone-400 mb-1">Marge Nette</p>
              <p className={`text-xl font-bold ${activeCycle.net_margin >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {formatFCFA(activeCycle.net_margin)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Charges fixes */}
      <div className="bg-white rounded-xl p-5 shadow-sm mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-stone-700">Charges Fixes</h2>
          <button
            onClick={() => setShowCostsModal(true)}
            className="flex items-center gap-1 text-xs text-yellow-600 hover:text-yellow-700 font-medium"
          >
            <Pencil size={12} /> Modifier
          </button>
        </div>
        <div className="grid grid-cols-6 gap-4">
          {[
            { label: 'Salaire', value: fixedCosts?.salary || 0 },
            { label: 'Prime', value: fixedCosts?.bonus || 0 },
            { label: 'Commission', value: fixedCosts?.commission || 0 },
            { label: 'Factures', value: fixedCosts?.invoices || 0 },
            { label: 'Internet', value: fixedCosts?.internet || 0 },
            { label: 'Imprévus', value: fixedCosts?.unexpected || 0 },
          ].map((item) => (
            <div key={item.label}>
              <p className="text-xs text-stone-400 mb-1">{item.label}</p>
              <p className="font-semibold text-stone-800">{formatFCFA(item.value)}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t border-stone-100">
          <p className="text-xs text-stone-400">Total charges fixes</p>
          <p className="text-lg font-bold text-red-500">{formatFCFA(fixedCosts?.total || 0)}</p>
        </div>
      </div>

      {/* Répartition */}
      {distribution && (
        <div className="bg-white rounded-xl p-5 shadow-sm mb-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-stone-700">Répartition Automatique</h2>
            <button
              onClick={() => setShowDistribModal(true)}
              className="flex items-center gap-1 text-xs text-yellow-600 hover:text-yellow-700 font-medium"
            >
              <Pencil size={12} /> Modifier %
            </button>
          </div>
          <p className="text-xs text-stone-400 mb-4">
            Marge Brute ({formatFCFA(activeCycle?.gross_margin || 0)}) - Charges Fixes ({formatFCFA(fixedCosts?.total || 0)}) = Marge Nette ({formatFCFA(netMargin)})
          </p>
          {netMargin <= 0 && (
            <p className="text-xs text-amber-500 mb-3">⚠ La répartition s'applique uniquement sur la marge nette positive</p>
          )}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Réinvestissement', pct: distribution.reinvestment_pct, color: 'text-blue-600' },
              { label: 'Marketing', pct: distribution.marketing_pct, color: 'text-purple-600' },
              { label: 'Épargne', pct: distribution.savings_pct, color: 'text-green-600' },
              { label: 'Propriétaire', pct: distribution.owner_pct, color: 'text-yellow-600' },
              { label: 'Dîme', pct: distribution.tithe_pct, color: 'text-orange-600' },
              { label: 'Imprévu', pct: distribution.unexpected_pct, color: 'text-red-500' },
            ].map((item) => (
              <div key={item.label} className="bg-stone-50 rounded-lg p-3">
                <p className="text-xs text-stone-400">{item.label} ({item.pct}%)</p>
                <p className={`text-lg font-bold ${item.color}`}>
                  {formatFCFA(distribAmount(item.pct))}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cycles clôturés */}
      {closedCycles.length > 0 && (
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <h2 className="font-semibold text-stone-700 mb-4">
            Cycles Clôturés ({closedCycles.length})
          </h2>
          <div className="space-y-3">
            {closedCycles.map((cycle) => (
              <div key={cycle.id} className="border border-stone-100 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-stone-700">
                    {new Date(cycle.started_at).toLocaleDateString('fr-FR')} → {cycle.closed_at ? new Date(cycle.closed_at).toLocaleDateString('fr-FR') : ''}
                  </p>
                  <span className="text-xs bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">Clôturé</span>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-stone-400">Ventes</p>
                    <p className="font-bold text-stone-800">{cycle.total_sales}</p>
                  </div>
                  <div>
                    <p className="text-xs text-stone-400">CA Brut</p>
                    <p className="font-bold text-stone-800">{formatFCFA(cycle.gross_revenue)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-stone-400">CA Net</p>
                    <p className="font-bold text-stone-800">{formatFCFA(cycle.net_revenue)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-stone-400">Marge Nette</p>
                    <p className={`font-bold ${cycle.net_margin >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {formatFCFA(cycle.net_margin)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal charges fixes */}
      {showCostsModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-stone-800">Modifier les charges fixes</h2>
              <button onClick={() => setShowCostsModal(false)}>
                <X size={18} className="text-stone-400" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'salary', label: 'Salaire fixe' },
                { key: 'bonus', label: 'Prime' },
                { key: 'commission', label: 'Commission' },
                { key: 'invoices', label: 'Factures' },
                { key: 'internet', label: 'Internet' },
                { key: 'unexpected', label: 'Imprévus' },
                { key: 'other', label: 'Autres' },
              ].map((field) => (
                <div key={field.key}>
                  <label className="block text-sm font-medium text-stone-700 mb-1">{field.label} (FCFA)</label>
                  <input
                    type="number"
                    value={costsForm[field.key as keyof typeof costsForm]}
                    onChange={(e) => setCostsForm({ ...costsForm, [field.key]: Number(e.target.value) })}
                    className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  />
                </div>
              ))}
            </div>
            <div className="mt-3 p-3 bg-stone-50 rounded-lg">
              <p className="text-sm font-medium text-stone-700">
                Total : {formatFCFA(Object.values(costsForm).reduce((sum, v) => sum + v, 0))}
              </p>
            </div>
            <div className="flex gap-3 mt-4">
              <button
                onClick={handleSaveCosts}
                disabled={saving}
                className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
              <button onClick={() => setShowCostsModal(false)} className="px-4 py-2 text-stone-600 hover:bg-stone-100 rounded-lg text-sm">
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal répartition */}
      {showDistribModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-stone-800">Modifier les pourcentages</h2>
              <button onClick={() => { setShowDistribModal(false); setError('') }}>
                <X size={18} className="text-stone-400" />
              </button>
            </div>
            <div className="space-y-3">
              {[
                { key: 'reinvestment_pct', label: 'Réinvestissement' },
                { key: 'marketing_pct', label: 'Marketing' },
                { key: 'savings_pct', label: 'Épargne' },
                { key: 'owner_pct', label: 'Propriétaire' },
                { key: 'tithe_pct', label: 'Dîme' },
                { key: 'unexpected_pct', label: 'Imprévu' },
              ].map((field) => (
                <div key={field.key} className="flex items-center gap-3">
                  <label className="text-sm text-stone-700 w-36">{field.label}</label>
                  <input
                    type="number"
                    value={distribForm[field.key as keyof typeof distribForm]}
                    onChange={(e) => setDistribForm({ ...distribForm, [field.key]: Number(e.target.value) })}
                    className="w-20 border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  />
                  <span className="text-sm text-stone-400">%</span>
                </div>
              ))}
            </div>
            <div className="mt-3 p-3 bg-stone-50 rounded-lg">
              <p className={`text-sm font-medium ${Object.values(distribForm).reduce((sum, v) => sum + v, 0) === 100 ? 'text-green-600' : 'text-red-500'}`}>
                Total : {Object.values(distribForm).reduce((sum, v) => sum + v, 0)}% (doit être 100%)
              </p>
            </div>
            {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
            <div className="flex gap-3 mt-4">
              <button
                onClick={handleSaveDistrib}
                disabled={saving}
                className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
              <button onClick={() => { setShowDistribModal(false); setError('') }} className="px-4 py-2 text-stone-600 hover:bg-stone-100 rounded-lg text-sm">
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal clôture */}
      {showCloseModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-stone-800">Clôturer le cycle</h2>
              <button onClick={() => setShowCloseModal(false)}>
                <X size={18} className="text-stone-400" />
              </button>
            </div>
            <p className="text-sm text-stone-500 mb-4">
              Cette action clôture le cycle actuel et en crée un nouveau. Les compteurs repartent à zéro.
            </p>
            <div className="bg-stone-50 rounded-lg p-4 mb-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-stone-500">CA Brut</span>
                <span className="font-medium">{formatFCFA(activeCycle?.gross_revenue || 0)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-stone-500">Marge Nette</span>
                <span className={`font-bold ${(activeCycle?.net_margin || 0) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {formatFCFA(activeCycle?.net_margin || 0)}
                </span>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleCloseCycle}
                disabled={saving}
                className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {saving ? 'Clôture...' : 'Confirmer la clôture'}
              </button>
              <button onClick={() => setShowCloseModal(false)} className="px-4 py-2 text-stone-600 hover:bg-stone-100 rounded-lg text-sm">
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}