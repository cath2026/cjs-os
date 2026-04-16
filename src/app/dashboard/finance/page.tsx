'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Plus, X, TrendingUp, DollarSign, Percent, Download, Eye, Share2, AlertTriangle, Check, Edit2, Trash2 } from 'lucide-react'

const SHOP_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

type Charge = { id: string; name: string; amount: number; category: string }
type Repartition = { id: string; name: string; percentage: number }
type Cycle = {
  id: string; start_date: string; end_date?: string; status: string
  ca_brut: number; ca_net: number; cout_revient: number; marge_brute: number
  charges_fixes_total: number; benefice_net: number
}

export default function FinancePage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [activeCycle, setActiveCycle] = useState<Cycle | null>(null)
  const [closedCycles, setClosedCycles] = useState<Cycle[]>([])
  const [charges, setCharges] = useState<Charge[]>([])
  const [repartition, setRepartition] = useState<Repartition[]>([])
  const [salesData, setSalesData] = useState({ ca_brut: 0, ca_net: 0, cout_revient: 0, nb_ventes: 0 })
  const [showChargeModal, setShowChargeModal] = useState(false)
  const [showRepartModal, setShowRepartModal] = useState(false)
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)
  const [editingCharge, setEditingCharge] = useState<Charge | null>(null)
  const [editingRepart, setEditingRepart] = useState<Repartition | null>(null)
  const [chargeForm, setChargeForm] = useState({ name: '', amount: 0, category: 'autre' })
  const [repartForm, setRepartForm] = useState({ name: '', percentage: 0 })
  const [saving, setSaving] = useState(false)
  const [selectedCycle, setSelectedCycle] = useState<Cycle | null>(null)
  const [cycleVentes, setCycleVentes] = useState<any[]>([])
  const [showCycleDetail, setShowCycleDetail] = useState(false)

  const fetchAll = async () => {
    setLoading(true)

    // Cycles
    const { data: cycles } = await supabase
      .from('finance_cycles')
      .select('*')
      .eq('shop_id', SHOP_ID)
      .order('created_at', { ascending: false })

    const active = cycles?.find(c => c.status === 'active') || null
    const closed = cycles?.filter(c => c.status === 'closed') || []
    setActiveCycle(active)
    setClosedCycles(closed)

    // Charges
    const { data: ch } = await supabase
      .from('finance_charges')
      .select('*')
      .eq('shop_id', SHOP_ID)
      .eq('is_active', true)
      .order('category')
    setCharges(ch || [])

    // Répartition
    const { data: rp } = await supabase
      .from('finance_repartition')
      .select('*')
      .eq('shop_id', SHOP_ID)
      .eq('is_active', true)
    setRepartition(rp || [])

    // Ventes boutique + site
    const startDate = active?.start_date || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]

    const { data: boutiqueSales } = await supabase
      .from('sales')
      .select('*, sale_items(*)')
      .eq('shop_id', SHOP_ID)
      .eq('status', 'paid')
      .gte('created_at', startDate)

    const { data: siteSales } = await supabase
      .from('orders')
      .select('*, items')
      .eq('shop_id', SHOP_ID)
      .eq('status', 'livré')
      .gte('created_at', startDate)

    const ca_boutique = boutiqueSales?.reduce((s, v) => s + (v.total || 0), 0) || 0
    const ca_site = siteSales?.reduce((s, v) => s + (v.total || 0), 0) || 0
    const ca_brut = ca_boutique + ca_site

    const remises_boutique = boutiqueSales?.reduce((s, v) => s + (v.discount_amount || 0), 0) || 0
    const remises_site = siteSales?.reduce((s, v) => s + (v.discount || 0), 0) || 0
    const ca_net = ca_brut - remises_boutique - remises_site

    const cout_boutique = boutiqueSales?.reduce((s, v) =>
      s + (v.sale_items || []).reduce((si: number, i: any) => si + (i.unit_cost || 0) * i.quantity, 0), 0) || 0

    setSalesData({
      ca_brut,
      ca_net,
      cout_revient: cout_boutique,
      nb_ventes: (boutiqueSales?.length || 0) + (siteSales?.length || 0)
    })

    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  // Calculs
  const totalCharges = charges.reduce((s, c) => s + c.amount, 0)
  const marge_brute = salesData.ca_net - salesData.cout_revient
  const benefice_net = Math.max(0, marge_brute - totalCharges)
  const repartTotal = repartition.reduce((s, r) => s + r.percentage, 0)
  const formatFCFA = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA'
  const formatDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })

  // CLÔTURE CYCLE
  const handleCloseCycle = async () => {
    setSaving(true)
    let cycleId = activeCycle?.id

    if (!cycleId) {
      // Créer un cycle si aucun n'existe
      const startDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
      const { data } = await supabase.from('finance_cycles').insert({
        shop_id: SHOP_ID,
        start_date: startDate,
        status: 'active'
      }).select().single()
      cycleId = data?.id
    }

    await supabase.from('finance_cycles').update({
      status: 'closed',
      end_date: new Date().toISOString().split('T')[0],
      ca_brut: salesData.ca_brut,
      ca_net: salesData.ca_net,
      cout_revient: salesData.cout_revient,
      marge_brute,
      charges_fixes_total: totalCharges,
      benefice_net,
    }).eq('id', cycleId)

    // Créer nouveau cycle actif
    await supabase.from('finance_cycles').insert({
      shop_id: SHOP_ID,
      start_date: new Date().toISOString().split('T')[0],
      status: 'active'
    })

    setSaving(false)
    setShowCloseConfirm(false)
    fetchAll()
  }

  // CHARGES
  const handleSaveCharge = async () => {
    if (!chargeForm.name || chargeForm.amount <= 0) return
    setSaving(true)
    if (editingCharge) {
      await supabase.from('finance_charges').update({ name: chargeForm.name, amount: chargeForm.amount, category: chargeForm.category }).eq('id', editingCharge.id)
    } else {
      await supabase.from('finance_charges').insert({ shop_id: SHOP_ID, name: chargeForm.name, amount: chargeForm.amount, category: chargeForm.category })
    }
    setSaving(false)
    setShowChargeModal(false)
    setEditingCharge(null)
    setChargeForm({ name: '', amount: 0, category: 'autre' })
    fetchAll()
  }

  const handleDeleteCharge = async (id: string) => {
    await supabase.from('finance_charges').update({ is_active: false }).eq('id', id)
    fetchAll()
  }

  // RÉPARTITION
  const handleSaveRepart = async () => {
    if (!repartForm.name || repartForm.percentage <= 0) return
    setSaving(true)
    if (editingRepart) {
      await supabase.from('finance_repartition').update({ name: repartForm.name, percentage: repartForm.percentage }).eq('id', editingRepart.id)
    } else {
      await supabase.from('finance_repartition').insert({ shop_id: SHOP_ID, name: repartForm.name, percentage: repartForm.percentage })
    }
    setSaving(false)
    setShowRepartModal(false)
    setEditingRepart(null)
    setRepartForm({ name: '', percentage: 0 })
    fetchAll()
  }

  const handleDeleteRepart = async (id: string) => {
    await supabase.from('finance_repartition').update({ is_active: false }).eq('id', id)
    fetchAll()
  }

  // DÉTAIL CYCLE
  const handleViewCycle = async (cycle: Cycle) => {
    setSelectedCycle(cycle)
    const { data } = await supabase
      .from('sales')
      .select('*, sale_items(*)')
      .eq('shop_id', SHOP_ID)
      .eq('status', 'paid')
      .gte('created_at', cycle.start_date)
      .lte('created_at', cycle.end_date || new Date().toISOString())
    setCycleVentes(data || [])
    setShowCycleDetail(true)
  }

  const handleDownloadCycle = (cycle: Cycle) => {
    const content = `RAPPORT FINANCIER — CATH JEWELRY STORE
Cycle: ${formatDate(cycle.start_date)} → ${formatDate(cycle.end_date || '')}
=====================================
CA Brut: ${formatFCFA(cycle.ca_brut)}
CA Net: ${formatFCFA(cycle.ca_net)}
Coût de revient: ${formatFCFA(cycle.cout_revient)}
Marge brute: ${formatFCFA(cycle.marge_brute)}
Charges fixes: ${formatFCFA(cycle.charges_fixes_total)}
Bénéfice net: ${formatFCFA(cycle.benefice_net)}
`.trim()
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cycle-${cycle.start_date}.txt`
    a.click()
  }

  const handleShareCycle = (cycle: Cycle) => {
    const text = `Cycle CJS ${formatDate(cycle.start_date)} → ${formatDate(cycle.end_date || '')}\nCA: ${formatFCFA(cycle.ca_brut)}\nBénéfice: ${formatFCFA(cycle.benefice_net)}`
    if (navigator.share) navigator.share({ title: 'Rapport CJS', text })
    else navigator.clipboard.writeText(text).then(() => alert('Copié !'))
  }

  if (loading) return (
    <div className="p-6 flex items-center justify-center h-64">
      <p className="text-stone-400 text-sm">Chargement...</p>
    </div>
  )

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <style>{`
        .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
        .two-col { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
        @media (max-width: 1024px) { .kpi-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 640px) {
          .kpi-grid { grid-template-columns: repeat(2, 1fr); gap: 8px; }
          .two-col { grid-template-columns: 1fr; }
        }
      `}</style>

      {/* HEADER */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-semibold text-stone-800">Finance</h1>
          <p className="text-stone-400 text-xs">
            {activeCycle
              ? `Cycle en cours depuis le ${formatDate(activeCycle.start_date)} · ${salesData.nb_ventes} vente(s)`
              : `Mois en cours · ${salesData.nb_ventes} vente(s)`
            }
          </p>
        </div>
        <button
          onClick={() => setShowCloseConfirm(true)}
          className="flex items-center gap-1.5 border border-red-300 hover:bg-red-50 text-red-500 px-4 py-2 rounded-lg text-sm font-medium"
        >
          Clôturer le cycle
        </button>
      </div>

      {/* KPI */}
      <div className="kpi-grid">
        {[
          { label: 'CA Brut', value: salesData.ca_brut, icon: TrendingUp, color: 'text-blue-500', bg: 'bg-blue-50', sub: `${salesData.nb_ventes} ventes` },
          { label: 'CA Net', value: salesData.ca_net, icon: DollarSign, color: 'text-green-500', bg: 'bg-green-50', sub: 'Après réductions' },
          { label: 'Marge Brute', value: marge_brute, icon: Percent, color: 'text-yellow-500', bg: 'bg-yellow-50', sub: salesData.ca_net > 0 ? `${Math.round((marge_brute / salesData.ca_net) * 100)}% du CA net` : '—' },
          { label: 'Bénéfice Net', value: benefice_net, icon: DollarSign, color: 'text-purple-500', bg: 'bg-purple-50', sub: benefice_net > 0 ? 'Après charges' : '⚠ Charges non couvertes' },
        ].map((kpi, i) => (
          <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-stone-100">
            <div className="flex items-center gap-2 mb-3">
              <div className={`${kpi.bg} p-2 rounded-lg`}>
                <kpi.icon size={15} className={kpi.color} />
              </div>
              <p className="text-xs text-stone-400 font-medium">{kpi.label}</p>
            </div>
            <p className="text-base font-bold text-stone-800 mb-0.5">{formatFCFA(kpi.value)}</p>
            <p className="text-xs text-stone-400">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* CHARGES FIXES + RÉPARTITION */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* CHARGES */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-stone-100">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-semibold text-stone-800 text-sm">Charges fixes</h2>
              <p className="text-xs text-stone-400">Total: <strong className="text-stone-600">{formatFCFA(totalCharges)}</strong></p>
            </div>
            <button onClick={() => { setEditingCharge(null); setChargeForm({ name: '', amount: 0, category: 'autre' }); setShowChargeModal(true) }}
              className="flex items-center gap-1 text-xs text-yellow-600 border border-yellow-300 px-2.5 py-1.5 rounded-lg font-medium">
              <Plus size={12} /> Ajouter
            </button>
          </div>

          {charges.length === 0 ? (
            <p className="text-stone-400 text-xs text-center py-6">Aucune charge définie — cliquez sur Ajouter</p>
          ) : (
            <div className="space-y-2">
              {charges.map(charge => (
                <div key={charge.id} className="flex items-center justify-between bg-stone-50 rounded-xl p-2.5">
                  <div>
                    <p className="text-xs font-medium text-stone-700">{charge.name}</p>
                    <p className="text-xs text-stone-400 capitalize">{charge.category}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-bold text-stone-800">{formatFCFA(charge.amount)}</p>
                    <button onClick={() => { setEditingCharge(charge); setChargeForm({ name: charge.name, amount: charge.amount, category: charge.category }); setShowChargeModal(true) }}
                      className="p-1 text-yellow-500 hover:bg-yellow-50 rounded">
                      <Edit2 size={11} />
                    </button>
                    <button onClick={() => handleDeleteCharge(charge.id)} className="p-1 text-red-400 hover:bg-red-50 rounded">
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {marge_brute > 0 && charges.length > 0 && (
            <div className="mt-3 pt-3 border-t border-stone-100">
              <div className="flex justify-between text-xs text-stone-400 mb-1">
                <span>Saturation des charges</span>
                <span>{Math.min(100, Math.round((totalCharges / marge_brute) * 100))}%</span>
              </div>
              <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${totalCharges > marge_brute ? 'bg-red-400' : 'bg-yellow-400'}`}
                  style={{ width: `${Math.min(100, (totalCharges / marge_brute) * 100)}%` }} />
              </div>
              {totalCharges > marge_brute && (
                <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                  <AlertTriangle size={10} /> Les charges dépassent la marge brute
                </p>
              )}
            </div>
          )}
        </div>

        {/* RÉPARTITION */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-stone-100">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-semibold text-stone-800 text-sm">Répartition du bénéfice</h2>
              <p className="text-xs text-stone-400">
                {repartTotal}% défini · {100 - repartTotal}% libre
              </p>
            </div>
            <button onClick={() => { setEditingRepart(null); setRepartForm({ name: '', percentage: 0 }); setShowRepartModal(true) }}
              className="flex items-center gap-1 text-xs text-yellow-600 border border-yellow-300 px-2.5 py-1.5 rounded-lg font-medium">
              <Plus size={12} /> Ajouter
            </button>
          </div>

          {benefice_net === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 mb-3 text-xs text-amber-700 flex items-center gap-1.5">
              <AlertTriangle size={12} />
              La répartition s'applique uniquement après couverture des charges fixes
            </div>
          )}

          {repartition.length === 0 ? (
            <p className="text-stone-400 text-xs text-center py-6">Aucune règle définie — cliquez sur Ajouter</p>
          ) : (
            <div className="space-y-2">
              {repartition.map(r => {
                const montant = Math.round(benefice_net * r.percentage / 100)
                return (
                  <div key={r.id} className="bg-stone-50 rounded-xl p-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-medium text-stone-700">{r.name}</p>
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-bold text-yellow-600">{r.percentage}%</span>
                        <button onClick={() => { setEditingRepart(r); setRepartForm({ name: r.name, percentage: r.percentage }); setShowRepartModal(true) }}
                          className="p-1 text-yellow-500 hover:bg-yellow-50 rounded">
                          <Edit2 size={11} />
                        </button>
                        <button onClick={() => handleDeleteRepart(r.id)} className="p-1 text-red-400 hover:bg-red-50 rounded">
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex-1 h-1.5 bg-stone-200 rounded-full overflow-hidden mr-3">
                        <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${r.percentage}%` }} />
                      </div>
                      <span className={`text-xs font-bold ${benefice_net > 0 ? 'text-stone-800' : 'text-stone-300'}`}>
                        {formatFCFA(montant)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {repartTotal > 100 && (
            <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
              <AlertTriangle size={10} /> Total dépasse 100% ({repartTotal}%)
            </p>
          )}
        </div>
      </div>

      {/* HISTORIQUE CYCLES */}
      {closedCycles.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-stone-100">
          <h2 className="font-semibold text-stone-800 text-sm mb-3">Historique des cycles clôturés</h2>
          <div className="space-y-3">
            {closedCycles.map(cycle => (
              <div key={cycle.id} className="border border-stone-100 rounded-xl p-3">
                <div className="flex items-start justify-between flex-wrap gap-2">
                  <div>
                    <p className="text-sm font-semibold text-stone-800">
                      {formatDate(cycle.start_date)} → {formatDate(cycle.end_date || '')}
                    </p>
                    <div className="flex gap-3 mt-1 flex-wrap">
                      <span className="text-xs text-stone-400">CA: <strong className="text-stone-600">{formatFCFA(cycle.ca_brut)}</strong></span>
                      <span className="text-xs text-stone-400">Marge: <strong className="text-stone-600">{formatFCFA(cycle.marge_brute)}</strong></span>
                      <span className="text-xs text-stone-400">Bénéfice: <strong className={cycle.benefice_net > 0 ? 'text-green-600' : 'text-red-500'}>{formatFCFA(cycle.benefice_net)}</strong></span>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => handleViewCycle(cycle)} className="flex items-center gap-1 text-xs border border-stone-200 hover:bg-stone-50 text-stone-600 px-2 py-1.5 rounded-lg">
                      <Eye size={11} /> Voir
                    </button>
                    <button onClick={() => handleDownloadCycle(cycle)} className="flex items-center gap-1 text-xs border border-stone-200 hover:bg-stone-50 text-stone-600 px-2 py-1.5 rounded-lg">
                      <Download size={11} /> PDF
                    </button>
                    <button onClick={() => handleShareCycle(cycle)} className="flex items-center gap-1 text-xs border border-stone-200 hover:bg-stone-50 text-stone-600 px-2 py-1.5 rounded-lg">
                      <Share2 size={11} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL CHARGE */}
      {showChargeModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl p-5 w-full sm:max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-stone-800">{editingCharge ? 'Modifier la charge' : 'Nouvelle charge'}</h2>
              <button onClick={() => { setShowChargeModal(false); setEditingCharge(null) }}><X size={16} className="text-stone-400" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">Nom *</label>
                <input value={chargeForm.name} onChange={e => setChargeForm({ ...chargeForm, name: e.target.value })}
                  placeholder="Ex: Salaire vendeuse, Loyer..." className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">Montant (FCFA) *</label>
                <input type="number" value={chargeForm.amount} onChange={e => setChargeForm({ ...chargeForm, amount: Number(e.target.value) })}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">Catégorie</label>
                <select value={chargeForm.category} onChange={e => setChargeForm({ ...chargeForm, category: e.target.value })}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400">
                  {['salaire', 'loyer', 'factures', 'internet', 'marketing', 'autre'].map(c => (
                    <option key={c} value={c} className="capitalize">{c}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={handleSaveCharge} disabled={saving}
                className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
                {saving ? '...' : editingCharge ? 'Modifier' : 'Ajouter'}
              </button>
              <button onClick={() => { setShowChargeModal(false); setEditingCharge(null) }}
                className="px-4 py-2 text-stone-600 hover:bg-stone-100 rounded-lg text-sm">Annuler</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL RÉPARTITION */}
      {showRepartModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl p-5 w-full sm:max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-stone-800">{editingRepart ? 'Modifier' : 'Nouvelle répartition'}</h2>
              <button onClick={() => { setShowRepartModal(false); setEditingRepart(null) }}><X size={16} className="text-stone-400" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">Nom *</label>
                <input value={repartForm.name} onChange={e => setRepartForm({ ...repartForm, name: e.target.value })}
                  placeholder="Ex: Réinvestissement, Épargne, Marketing..." className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Pourcentage (%) * — Restant disponible: {100 - repartTotal + (editingRepart?.percentage || 0)}%
                </label>
                <input type="number" min="1" max={100 - repartTotal + (editingRepart?.percentage || 0)}
                  value={repartForm.percentage} onChange={e => setRepartForm({ ...repartForm, percentage: Number(e.target.value) })}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
              </div>
              {benefice_net > 0 && repartForm.percentage > 0 && (
                <div className="bg-green-50 rounded-lg p-3 text-xs text-green-700">
                  Montant estimé: <strong>{formatFCFA(Math.round(benefice_net * repartForm.percentage / 100))}</strong>
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={handleSaveRepart} disabled={saving}
                className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
                {saving ? '...' : editingRepart ? 'Modifier' : 'Ajouter'}
              </button>
              <button onClick={() => { setShowRepartModal(false); setEditingRepart(null) }}
                className="px-4 py-2 text-stone-600 hover:bg-stone-100 rounded-lg text-sm">Annuler</button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION CLÔTURE */}
      {showCloseConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={18} className="text-red-500" />
              </div>
              <div>
                <h2 className="font-semibold text-stone-800">Clôturer le cycle ?</h2>
                <p className="text-xs text-red-400 font-medium">Action irrévocable</p>
              </div>
            </div>
            <div className="bg-stone-50 rounded-xl p-3 mb-4 space-y-1.5 text-xs">
              <div className="flex justify-between"><span className="text-stone-500">CA Brut</span><span className="font-medium">{formatFCFA(salesData.ca_brut)}</span></div>
              <div className="flex justify-between"><span className="text-stone-500">CA Net</span><span className="font-medium">{formatFCFA(salesData.ca_net)}</span></div>
              <div className="flex justify-between"><span className="text-stone-500">Marge brute</span><span className="font-medium">{formatFCFA(marge_brute)}</span></div>
              <div className="flex justify-between"><span className="text-stone-500">Charges fixes</span><span className="font-medium">{formatFCFA(totalCharges)}</span></div>
              <div className="flex justify-between border-t border-stone-200 pt-1.5 mt-1">
                <span className="font-semibold">Bénéfice net</span>
                <span className={`font-bold ${benefice_net > 0 ? 'text-green-600' : 'text-red-500'}`}>{formatFCFA(benefice_net)}</span>
              </div>
            </div>
            <p className="text-sm text-stone-600 mb-4 text-center">Confirmez-vous la clôture définitive ?</p>
            <div className="flex gap-2">
              <button onClick={handleCloseCycle} disabled={saving}
                className="flex-1 flex items-center justify-center gap-1.5 bg-red-500 hover:bg-red-600 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
                <Check size={14} /> Oui, clôturer
              </button>
              <button onClick={() => setShowCloseConfirm(false)}
                className="flex-1 border border-stone-300 text-stone-600 hover:bg-stone-50 py-2.5 rounded-lg text-sm">
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DÉTAIL CYCLE */}
      {showCycleDetail && selectedCycle && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-stone-100 sticky top-0 bg-white">
              <div>
                <h2 className="font-semibold text-stone-800">Cycle {formatDate(selectedCycle.start_date)} → {formatDate(selectedCycle.end_date || '')}</h2>
                <p className="text-xs text-stone-400">{cycleVentes.length} vente(s) enregistrée(s)</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleDownloadCycle(selectedCycle)} className="flex items-center gap-1 text-xs border border-stone-200 hover:bg-stone-50 text-stone-600 px-2 py-1.5 rounded-lg">
                  <Download size={11} /> Télécharger
                </button>
                <button onClick={() => setShowCycleDetail(false)}><X size={18} className="text-stone-400" /></button>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {/* KPI résumé */}
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  { label: 'CA Brut', value: selectedCycle.ca_brut },
                  { label: 'CA Net', value: selectedCycle.ca_net },
                  { label: 'Coût de revient', value: selectedCycle.cout_revient },
                  { label: 'Marge Brute', value: selectedCycle.marge_brute },
                  { label: 'Charges fixes', value: selectedCycle.charges_fixes_total },
                  { label: 'Bénéfice net', value: selectedCycle.benefice_net },
                ].map((item, i) => (
                  <div key={i} className="bg-stone-50 rounded-xl p-3">
                    <p className="text-xs text-stone-400 mb-0.5">{item.label}</p>
                    <p className={`text-sm font-bold ${i === 5 && item.value > 0 ? 'text-green-600' : i === 5 ? 'text-red-500' : 'text-stone-800'}`}>
                      {formatFCFA(item.value)}
                    </p>
                  </div>
                ))}
              </div>

              {/* Ventes */}
              <div>
                <h3 className="text-sm font-semibold text-stone-700 mb-2">Détail des ventes</h3>
                {cycleVentes.length === 0 ? (
                  <p className="text-stone-400 text-xs text-center py-4">Aucune vente trouvée pour cette période</p>
                ) : (
                  <div className="space-y-2">
                    {cycleVentes.map((vente, i) => {
                      const coutVente = (vente.sale_items || []).reduce((s: number, item: any) => s + (item.unit_cost || 0) * item.quantity, 0)
                      const margeVente = vente.total - coutVente
                      return (
                        <div key={i} className="border border-stone-100 rounded-xl p-3">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <p className="text-xs font-medium text-stone-700">{vente.customer_name || vente.customer?.full_name || 'Client anonyme'}</p>
                              <p className="text-xs text-stone-400">{formatDate(vente.created_at)} · {vente.payment_method || '—'}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-stone-800">{formatFCFA(vente.total)}</p>
                              <p className="text-xs text-green-600">Marge: {formatFCFA(margeVente)}</p>
                            </div>
                          </div>
                          {(vente.sale_items || []).map((item: any, j: number) => (
                            <div key={j} className="flex justify-between text-xs text-stone-400 bg-stone-50 rounded-lg px-2 py-1 mt-1">
                              <span>{item.product_name} {item.variant_name || ''} x{item.quantity}</span>
                              <span>Revient: {formatFCFA((item.unit_cost || 0) * item.quantity)}</span>
                            </div>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}