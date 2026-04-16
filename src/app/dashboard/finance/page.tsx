'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Plus, X, TrendingUp, DollarSign, ShoppingBag, Percent, Download, Eye, Share2, AlertTriangle, Check } from 'lucide-react'

const SHOP_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

type Charge = { id: string; name: string; amount: number; category: string; is_active: boolean }
type Repartition = { id: string; name: string; percentage: number; is_active: boolean }
type Cycle = {
  id: string; start_date: string; end_date?: string; status: string
  ca_brut: number; ca_net: number; cout_revient: number; marge_brute: number
  charges_fixes_total: number; benefice_net: number; notes?: string
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

    // Ventes du cycle actif
    if (active) {
      const { data: sales } = await supabase
        .from('sales')
        .select('*, sale_items(*)')
        .eq('shop_id', SHOP_ID)
        .eq('status', 'paid')
        .gte('created_at', active.start_date)
        .order('created_at', { ascending: false })

      const ca_brut = sales?.reduce((s, v) => s + v.total, 0) || 0
      const ca_net = ca_brut - (sales?.reduce((s, v) => s + (v.discount_amount || 0), 0) || 0)
      const cout_revient = sales?.reduce((s, v) =>
        s + v.sale_items.reduce((si: number, i: any) => si + (i.unit_cost || 0) * i.quantity, 0), 0) || 0

      setSalesData({ ca_brut, ca_net, cout_revient, nb_ventes: sales?.length || 0 })
    } else {
      setSalesData({ ca_brut: 0, ca_net: 0, cout_revient: 0, nb_ventes: 0 })
    }

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

  // CYCLE
  const handleStartCycle = async () => {
    const { data } = await supabase
      .from('finance_cycles')
      .insert({ shop_id: SHOP_ID, start_date: new Date().toISOString().split('T')[0], status: 'active' })
      .select().single()
    setActiveCycle(data)
    fetchAll()
  }

  const handleCloseCycle = async () => {
    if (!activeCycle) return
    setSaving(true)
    await supabase.from('finance_cycles').update({
      status: 'closed',
      end_date: new Date().toISOString().split('T')[0],
      ca_brut: salesData.ca_brut,
      ca_net: salesData.ca_net,
      cout_revient: salesData.cout_revient,
      marge_brute,
      charges_fixes_total: totalCharges,
      benefice_net,
    }).eq('id', activeCycle.id)
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
    if (repartTotal + repartForm.percentage > 100 && !editingRepart) return
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

  const handleDownloadCycle = async (cycle: Cycle) => {
    await handleViewCycle(cycle)
    setTimeout(() => {
      const content = `
RAPPORT FINANCIER — CATH JEWELRY STORE
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
    }, 500)
  }

  const handleShareCycle = (cycle: Cycle) => {
    const text = `Cycle CJS ${formatDate(cycle.start_date)} → ${formatDate(cycle.end_date || '')}\nCA: ${formatFCFA(cycle.ca_brut)}\nBénéfice: ${formatFCFA(cycle.benefice_net)}`
    if (navigator.share) navigator.share({ title: 'Rapport CJS', text })
    else navigator.clipboard.writeText(text).then(() => alert('Copié !'))
  }

  const chargeCategories = ['salaire', 'loyer', 'factures', 'internet', 'marketing', 'autre']

  if (loading) return <div className="p-6 text-stone-400">Chargement...</div>

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <style>{`
        .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
        .charge-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
        .repart-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
        @media (max-width: 1024px) { .kpi-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 640px) {
          .kpi-grid { grid-template-columns: repeat(2, 1fr); }
          .charge-grid { grid-template-columns: 1fr; }
          .repart-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-stone-800">Finance</h1>
          <p className="text-stone-400 text-xs">Suivi financier de votre boutique</p>
        </div>
        {!activeCycle && (
          <button onClick={handleStartCycle} className="flex items-center gap-1.5 bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
            <Plus size={14} /> Nouveau cycle
          </button>
        )}
      </div>

      {/* PAS DE CYCLE */}
      {!activeCycle ? (
        <div className="bg-white rounded-2xl p-10 shadow-sm text-center border border-dashed border-stone-200">
          <DollarSign size={40} className="text-stone-300 mx-auto mb-3" />
          <p className="text-stone-500 font-medium mb-1">Aucun cycle actif</p>
          <p className="text-stone-400 text-sm mb-4">Démarrez un nouveau cycle pour suivre vos finances</p>
          <button onClick={handleStartCycle} className="bg-yellow-600 hover:bg-yellow-700 text-white px-6 py-2.5 rounded-lg text-sm font-medium">
            Démarrer un cycle
          </button>
        </div>
      ) : (
        <>
          {/* CYCLE ACTIF */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-yellow-100">
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <p className="text-sm font-semibold text-stone-800">Cycle en cours</p>
                </div>
                <p className="text-xs text-stone-400">Depuis le {formatDate(activeCycle.start_date)} · {salesData.nb_ventes} vente(s)</p>
              </div>
              <button
                onClick={() => setShowCloseConfirm(true)}
                className="flex items-center gap-1.5 border border-red-300 hover:bg-red-50 text-red-500 px-3 py-1.5 rounded-lg text-xs font-medium"
              >
                Clôturer le cycle
              </button>
            </div>
          </div>

          {/* KPI */}
          <div className="kpi-grid">
            {[
              { label: 'CA Brut', value: salesData.ca_brut, icon: TrendingUp, color: 'text-blue-500', bg: 'bg-blue-50' },
              { label: 'CA Net', value: salesData.ca_net, icon: DollarSign, color: 'text-green-500', bg: 'bg-green-50' },
              { label: 'Marge Brute', value: marge_brute, icon: Percent, color: 'text-yellow-500', bg: 'bg-yellow-50' },
              { label: 'Bénéfice Net', value: benefice_net, icon: ShoppingBag, color: 'text-purple-500', bg: 'bg-purple-50' },
            ].map((kpi, i) => (
              <div key={i} className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`${kpi.bg} p-2 rounded-lg`}>
                    <kpi.icon size={16} className={kpi.color} />
                  </div>
                  <p className="text-xs text-stone-400 font-medium">{kpi.label}</p>
                </div>
                <p className="text-lg font-bold text-stone-800">{formatFCFA(kpi.value)}</p>
                {i === 2 && salesData.ca_net > 0 && (
                  <p className="text-xs text-stone-400 mt-0.5">
                    {Math.round((marge_brute / salesData.ca_net) * 100)}% du CA net
                  </p>
                )}
                {i === 3 && marge_brute > 0 && (
                  <p className={`text-xs mt-0.5 ${benefice_net > 0 ? 'text-green-500' : 'text-red-400'}`}>
                    {benefice_net > 0 ? '✓ Après charges' : '⚠ Charges non couvertes'}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* CHARGES FIXES */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold text-stone-800">Charges fixes</h2>
                <p className="text-xs text-stone-400">Total: {formatFCFA(totalCharges)}</p>
              </div>
              <button onClick={() => { setEditingCharge(null); setChargeForm({ name: '', amount: 0, category: 'autre' }); setShowChargeModal(true) }}
                className="flex items-center gap-1 text-xs text-yellow-600 border border-yellow-300 px-2.5 py-1.5 rounded-lg font-medium">
                <Plus size={12} /> Ajouter
              </button>
            </div>

            {charges.length === 0 ? (
              <p className="text-stone-400 text-sm text-center py-4">Aucune charge définie</p>
            ) : (
              <div className="charge-grid">
                {charges.map(charge => (
                  <div key={charge.id} className="flex items-center justify-between bg-stone-50 rounded-xl p-3">
                    <div>
                      <p className="text-sm font-medium text-stone-700">{charge.name}</p>
                      <p className="text-xs text-stone-400 capitalize">{charge.category}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-stone-800">{formatFCFA(charge.amount)}</p>
                      <button onClick={() => { setEditingCharge(charge); setChargeForm({ name: charge.name, amount: charge.amount, category: charge.category }); setShowChargeModal(true) }}
                        className="text-xs text-yellow-600 px-1.5 py-0.5 border border-yellow-200 rounded">
                        ✎
                      </button>
                      <button onClick={() => handleDeleteCharge(charge.id)} className="text-xs text-red-400 px-1.5 py-0.5 border border-red-200 rounded">
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Jauge charges vs marge */}
            {marge_brute > 0 && (
              <div className="mt-4 pt-3 border-t border-stone-100">
                <div className="flex justify-between text-xs text-stone-400 mb-1">
                  <span>Charges ({Math.round((totalCharges / marge_brute) * 100)}% de la marge)</span>
                  <span>{formatFCFA(totalCharges)} / {formatFCFA(marge_brute)}</span>
                </div>
                <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${totalCharges > marge_brute ? 'bg-red-400' : 'bg-yellow-400'}`}
                    style={{ width: `${Math.min(100, (totalCharges / marge_brute) * 100)}%` }}
                  />
                </div>
                {totalCharges > marge_brute && (
                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                    <AlertTriangle size={11} /> Les charges dépassent la marge brute
                  </p>
                )}
              </div>
            )}
          </div>

          {/* RÉPARTITION */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="font-semibold text-stone-800">Répartition du bénéfice</h2>
                <p className="text-xs text-stone-400">
                  {repartTotal}% défini · {100 - repartTotal}% restant
                  {benefice_net > 0 && ` · Distribué sur ${formatFCFA(benefice_net)}`}
                </p>
              </div>
              <button onClick={() => { setEditingRepart(null); setRepartForm({ name: '', percentage: 0 }); setShowRepartModal(true) }}
                className="flex items-center gap-1 text-xs text-yellow-600 border border-yellow-300 px-2.5 py-1.5 rounded-lg font-medium">
                <Plus size={12} /> Ajouter
              </button>
            </div>

            {benefice_net === 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3 text-xs text-amber-700 flex items-center gap-2">
                <AlertTriangle size={13} />
                La répartition ne s'applique qu'après couverture des charges fixes. Bénéfice net actuel: {formatFCFA(benefice_net)}
              </div>
            )}

            {repartition.length === 0 ? (
              <p className="text-stone-400 text-sm text-center py-4">Aucune règle de répartition définie</p>
            ) : (
              <div className="repart-grid">
                {repartition.map(r => {
                  const montant = Math.round(benefice_net * r.percentage / 100)
                  return (
                    <div key={r.id} className="bg-stone-50 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium text-stone-700">{r.name}</p>
                        <div className="flex items-center gap-1">
                          <button onClick={() => { setEditingRepart(r); setRepartForm({ name: r.name, percentage: r.percentage }); setShowRepartModal(true) }}
                            className="text-xs text-yellow-600 px-1.5 py-0.5 border border-yellow-200 rounded">✎</button>
                          <button onClick={() => handleDeleteRepart(r.id)} className="text-xs text-red-400 px-1.5 py-0.5 border border-red-200 rounded">✕</button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-yellow-600">{r.percentage}%</span>
                        <span className="text-sm font-bold text-stone-800">{formatFCFA(montant)}</span>
                      </div>
                      <div className="h-1.5 bg-stone-200 rounded-full mt-1.5 overflow-hidden">
                        <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${r.percentage}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {repartTotal > 100 && (
              <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
                <AlertTriangle size={11} /> Total dépasse 100% ({repartTotal}%)
              </p>
            )}
          </div>
        </>
      )}

      {/* CYCLES CLÔTURÉS */}
      {closedCycles.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h2 className="font-semibold text-stone-800 mb-4">Historique des cycles</h2>
          <div className="space-y-3">
            {closedCycles.map(cycle => (
              <div key={cycle.id} className="border border-stone-100 rounded-xl p-3">
                <div className="flex items-start justify-between flex-wrap gap-2">
                  <div>
                    <p className="text-sm font-semibold text-stone-800">
                      {formatDate(cycle.start_date)} → {formatDate(cycle.end_date || '')}
                    </p>
                    <div className="flex gap-4 mt-1 flex-wrap">
                      <span className="text-xs text-stone-400">CA: <strong className="text-stone-600">{formatFCFA(cycle.ca_brut)}</strong></span>
                      <span className="text-xs text-stone-400">Marge: <strong className="text-stone-600">{formatFCFA(cycle.marge_brute)}</strong></span>
                      <span className="text-xs text-stone-400">Bénéfice: <strong className={cycle.benefice_net > 0 ? 'text-green-600' : 'text-red-500'}>{formatFCFA(cycle.benefice_net)}</strong></span>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => handleViewCycle(cycle)} className="flex items-center gap-1 text-xs border border-stone-200 hover:bg-stone-50 text-stone-600 px-2 py-1.5 rounded-lg">
                      <Eye size={12} /> Voir
                    </button>
                    <button onClick={() => handleDownloadCycle(cycle)} className="flex items-center gap-1 text-xs border border-stone-200 hover:bg-stone-50 text-stone-600 px-2 py-1.5 rounded-lg">
                      <Download size={12} /> PDF
                    </button>
                    <button onClick={() => handleShareCycle(cycle)} className="flex items-center gap-1 text-xs border border-stone-200 hover:bg-stone-50 text-stone-600 px-2 py-1.5 rounded-lg">
                      <Share2 size={12} />
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
                <input value={chargeForm.name} onChange={e => setChargeForm({ ...chargeForm, name: e.target.value })} placeholder="Ex: Salaire vendeuse" className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">Montant (FCFA) *</label>
                <input type="number" value={chargeForm.amount} onChange={e => setChargeForm({ ...chargeForm, amount: Number(e.target.value) })} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">Catégorie</label>
                <select value={chargeForm.category} onChange={e => setChargeForm({ ...chargeForm, category: e.target.value })} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400">
                  {chargeCategories.map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={handleSaveCharge} disabled={saving} className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
                {saving ? '...' : editingCharge ? 'Modifier' : 'Ajouter'}
              </button>
              <button onClick={() => { setShowChargeModal(false); setEditingCharge(null) }} className="px-4 py-2 text-stone-600 hover:bg-stone-100 rounded-lg text-sm">Annuler</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL RÉPARTITION */}
      {showRepartModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl p-5 w-full sm:max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-stone-800">{editingRepart ? 'Modifier la répartition' : 'Nouvelle répartition'}</h2>
              <button onClick={() => { setShowRepartModal(false); setEditingRepart(null) }}><X size={16} className="text-stone-400" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">Nom *</label>
                <input value={repartForm.name} onChange={e => setRepartForm({ ...repartForm, name: e.target.value })} placeholder="Ex: Réinvestissement, Épargne..." className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Pourcentage (%) * — Restant: {100 - repartTotal + (editingRepart?.percentage || 0)}%
                </label>
                <input type="number" min="1" max={100 - repartTotal + (editingRepart?.percentage || 0)} value={repartForm.percentage} onChange={e => setRepartForm({ ...repartForm, percentage: Number(e.target.value) })} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
              </div>
              {benefice_net > 0 && repartForm.percentage > 0 && (
                <div className="bg-green-50 rounded-lg p-3 text-xs text-green-700">
                  Montant estimé: <strong>{formatFCFA(Math.round(benefice_net * repartForm.percentage / 100))}</strong>
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={handleSaveRepart} disabled={saving} className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
                {saving ? '...' : editingRepart ? 'Modifier' : 'Ajouter'}
              </button>
              <button onClick={() => { setShowRepartModal(false); setEditingRepart(null) }} className="px-4 py-2 text-stone-600 hover:bg-stone-100 rounded-lg text-sm">Annuler</button>
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
                <p className="text-xs text-stone-400">Cette action est irrévocable</p>
              </div>
            </div>
            <div className="bg-stone-50 rounded-xl p-3 mb-4 space-y-1 text-xs">
              <div className="flex justify-between"><span className="text-stone-500">CA Brut</span><span className="font-medium">{formatFCFA(salesData.ca_brut)}</span></div>
              <div className="flex justify-between"><span className="text-stone-500">Marge brute</span><span className="font-medium">{formatFCFA(marge_brute)}</span></div>
              <div className="flex justify-between"><span className="text-stone-500">Charges fixes</span><span className="font-medium">{formatFCFA(totalCharges)}</span></div>
              <div className="flex justify-between border-t border-stone-200 pt-1 mt-1"><span className="font-semibold">Bénéfice net</span><span className={`font-bold ${benefice_net > 0 ? 'text-green-600' : 'text-red-500'}`}>{formatFCFA(benefice_net)}</span></div>
            </div>
            <p className="text-sm text-stone-600 mb-4">Confirmez-vous la clôture définitive de ce cycle ?</p>
            <div className="flex gap-2">
              <button onClick={handleCloseCycle} disabled={saving} className="flex-1 flex items-center justify-center gap-1.5 bg-red-500 hover:bg-red-600 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
                <Check size={14} /> Oui, clôturer
              </button>
              <button onClick={() => setShowCloseConfirm(false)} className="flex-1 border border-stone-300 text-stone-600 hover:bg-stone-50 py-2.5 rounded-lg text-sm">
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DÉTAIL CYCLE */}
      {showCycleDetail && selectedCycle && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-stone-100">
              <div>
                <h2 className="font-semibold text-stone-800">Cycle {formatDate(selectedCycle.start_date)} → {formatDate(selectedCycle.end_date || '')}</h2>
                <p className="text-xs text-stone-400">{cycleVentes.length} vente(s)</p>
              </div>
              <button onClick={() => setShowCycleDetail(false)}><X size={18} className="text-stone-400" /></button>
            </div>

            <div className="p-5 space-y-4">
              {/* KPI résumé */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'CA Brut', value: selectedCycle.ca_brut },
                  { label: 'CA Net', value: selectedCycle.ca_net },
                  { label: 'Coût de revient', value: selectedCycle.cout_revient },
                  { label: 'Marge Brute', value: selectedCycle.marge_brute },
                  { label: 'Charges fixes', value: selectedCycle.charges_fixes_total },
                  { label: 'Bénéfice net', value: selectedCycle.benefice_net },
                ].map((item, i) => (
                  <div key={i} className="bg-stone-50 rounded-xl p-3">
                    <p className="text-xs text-stone-400">{item.label}</p>
                    <p className={`text-sm font-bold ${i === 5 && item.value > 0 ? 'text-green-600' : 'text-stone-800'}`}>{formatFCFA(item.value)}</p>
                  </div>
                ))}
              </div>

              {/* Ventes */}
              <div>
                <h3 className="text-sm font-semibold text-stone-700 mb-2">Ventes de la période</h3>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {cycleVentes.map((vente, i) => (
                    <div key={i} className="border border-stone-100 rounded-xl p-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-xs font-medium text-stone-700">{vente.customer_name || 'Client anonyme'}</p>
                          <p className="text-xs text-stone-400">{formatDate(vente.created_at)}</p>
                        </div>
                        <p className="text-sm font-bold text-stone-800">{formatFCFA(vente.total)}</p>
                      </div>
                      {vente.sale_items?.map((item: any, j: number) => (
                        <div key={j} className="flex justify-between text-xs text-stone-400 mt-1">
                          <span>{item.product_name} x{item.quantity}</span>
                          <span>Revient: {formatFCFA((item.unit_cost || 0) * item.quantity)}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}