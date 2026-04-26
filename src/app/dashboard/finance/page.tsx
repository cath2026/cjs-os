'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

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
  const [showAddCharge, setShowAddCharge] = useState(false)
  const [showAddRep, setShowAddRep] = useState(false)
  const [showClotureModal, setShowClotureModal] = useState(false)
  const [showEditChargeModal, setShowEditChargeModal] = useState(false)
  const [showEditRepModal, setShowEditRepModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [editingCharge, setEditingCharge] = useState<Charge | null>(null)
  const [editingRep, setEditingRep] = useState<Repartition | null>(null)
  const [selectedCycle, setSelectedCycle] = useState<Cycle | null>(null)
  const [cycleVentes, setCycleVentes] = useState<any[]>([])
  const [clotureConfirm, setClotureConfirm] = useState('')
  const [chargeForm, setChargeForm] = useState({ name: '', amount: 0 })
  const [repForm, setRepForm] = useState({ name: '', percentage: 0 })
  const [editChargeForm, setEditChargeForm] = useState({ name: '', amount: 0 })
  const [editRepForm, setEditRepForm] = useState({ name: '', percentage: 0 })
  const [toast, setToast] = useState('')
  const [saving, setSaving] = useState(false)
  const [generatingPdf, setGeneratingPdf] = useState(false)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2800) }

  const fmt = (n: number) => Math.round(n).toLocaleString('fr-FR')
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })

  const totalCharges = charges.reduce((s, c) => s + c.amount, 0)
  const margeBrute = salesData.ca_net - salesData.cout_revient
  const margeNette = Math.max(0, margeBrute - totalCharges)
  const totalRepPct = repartition.reduce((s, r) => s + r.percentage, 0)

  const fetchAll = async () => {
    setLoading(true)
    const { data: cycles } = await supabase.from('finance_cycles').select('*').eq('shop_id', SHOP_ID).order('created_at', { ascending: false })
    const active = cycles?.find(c => c.status === 'active') || null
    setActiveCycle(active)
    setClosedCycles(cycles?.filter(c => c.status === 'closed') || [])

    const { data: ch } = await supabase.from('finance_charges').select('*').eq('shop_id', SHOP_ID).eq('is_active', true)
    setCharges(ch || [])

    const { data: rp } = await supabase.from('finance_repartition').select('*').eq('shop_id', SHOP_ID).eq('is_active', true)
    setRepartition(rp || [])

    const startISO = active?.created_at ? new Date(active.created_at).toISOString() : new Date().toISOString()

    const { data: boutique } = await supabase.from('sales').select('*, sale_items(*)').eq('shop_id', SHOP_ID).eq('status', 'paid').gte('created_at', startISO)
    const { data: site } = await supabase.from('orders').select('*').eq('shop_id', SHOP_ID).eq('status', 'livré').gte('created_at', startISO)

    const ca_b = boutique?.reduce((s, v) => s + (v.total || 0), 0) || 0
    const ca_s = site?.reduce((s, v) => s + (v.total || 0), 0) || 0
    const ca_brut = ca_b + ca_s
    const remises = (boutique?.reduce((s, v) => s + (v.discount_amount || 0), 0) || 0) + (site?.reduce((s, v) => s + (v.discount || 0), 0) || 0)
    const ca_net = ca_brut - remises
    const cout = boutique?.reduce((s, v) => s + (v.sale_items || []).reduce((si: number, i: any) => si + (i.unit_cost || 0) * i.quantity, 0), 0) || 0

    setSalesData({ ca_brut, ca_net, cout_revient: cout, nb_ventes: (boutique?.length || 0) + (site?.length || 0) })
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  const handleCloture = async () => {
    if (clotureConfirm !== 'CONFIRMER') return
    setSaving(true)
    let cycleId = activeCycle?.id
    if (!cycleId) {
      const startDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
      const { data } = await supabase.from('finance_cycles').insert({ shop_id: SHOP_ID, start_date: startDate, status: 'active' }).select().single()
      cycleId = data?.id
    }
    await supabase.from('finance_cycles').update({
      status: 'closed', end_date: new Date().toISOString().split('T')[0],
      ca_brut: salesData.ca_brut, ca_net: salesData.ca_net, cout_revient: salesData.cout_revient,
      marge_brute: margeBrute, charges_fixes_total: totalCharges, benefice_net: margeNette,
    }).eq('id', cycleId)
    const { data: newCycle } = await supabase.from('finance_cycles').insert({ shop_id: SHOP_ID, start_date: new Date().toISOString().split('T')[0], status: 'active' }).select().single()
    setSalesData({ ca_brut: 0, ca_net: 0, cout_revient: 0, nb_ventes: 0 })
    setActiveCycle(newCycle)
    setSaving(false)
    setShowClotureModal(false)
    setClotureConfirm('')
    showToast('Cycle cloture avec succes')
    setTimeout(() => fetchAll(), 1000)
  }

  const handleAddCharge = async () => {
    if (!chargeForm.name || chargeForm.amount <= 0) { showToast('Remplissez tous les champs'); return }
    await supabase.from('finance_charges').insert({ shop_id: SHOP_ID, name: chargeForm.name, amount: chargeForm.amount, category: 'autre' })
    setChargeForm({ name: '', amount: 0 })
    setShowAddCharge(false)
    showToast(`Charge "${chargeForm.name}" ajoutee`)
    fetchAll()
  }

  const handleSaveCharge = async () => {
    if (!editingCharge) return
    await supabase.from('finance_charges').update({ name: editChargeForm.name, amount: editChargeForm.amount }).eq('id', editingCharge.id)
    setShowEditChargeModal(false)
    showToast('Charge modifiee')
    fetchAll()
  }

  const handleDeleteCharge = async () => {
    if (!editingCharge) return
    await supabase.from('finance_charges').update({ is_active: false }).eq('id', editingCharge.id)
    setShowEditChargeModal(false)
    showToast('Charge supprimee')
    fetchAll()
  }

  const handleAddRep = async () => {
    if (!repForm.name || repForm.percentage <= 0) { showToast('Verifiez les donnees'); return }
    if (totalRepPct + repForm.percentage > 100) { showToast('Total depasserait 100%'); return }
    await supabase.from('finance_repartition').insert({ shop_id: SHOP_ID, name: repForm.name, percentage: repForm.percentage })
    setRepForm({ name: '', percentage: 0 })
    setShowAddRep(false)
    showToast(`Categorie "${repForm.name}" ajoutee`)
    fetchAll()
  }

  const handleSaveRep = async () => {
    if (!editingRep) return
    const otherTotal = totalRepPct - editingRep.percentage
    if (otherTotal + editRepForm.percentage > 100) { showToast('Total depasserait 100%'); return }
    await supabase.from('finance_repartition').update({ name: editRepForm.name, percentage: editRepForm.percentage }).eq('id', editingRep.id)
    setShowEditRepModal(false)
    showToast('Repartition modifiee')
    fetchAll()
  }

  const handleDeleteRep = async () => {
    if (!editingRep) return
    await supabase.from('finance_repartition').update({ is_active: false }).eq('id', editingRep.id)
    setShowEditRepModal(false)
    showToast('Categorie supprimee')
    fetchAll()
  }

  const handleViewCycle = async (cycle: Cycle) => {
    setSelectedCycle(cycle)
    const startISO = new Date(cycle.start_date).toISOString()
    const endISO = cycle.end_date ? new Date(cycle.end_date + 'T23:59:59').toISOString() : new Date().toISOString()

    const { data: boutique } = await supabase.from('sales').select('*, sale_items(*)').eq('shop_id', SHOP_ID).eq('status', 'paid').gte('created_at', startISO).lte('created_at', endISO)
    const { data: site } = await supabase.from('orders').select('*').eq('shop_id', SHOP_ID).eq('status', 'livré').gte('created_at', startISO).lte('created_at', endISO)

    const allVentes = [
      ...(boutique || []).map(v => ({ ...v, source: 'boutique' })),
      ...(site || []).map(v => ({ ...v, source: 'site', sale_items: v.items || [] })),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    setCycleVentes(allVentes)
    setShowDetailModal(true)
  }

  const handleGeneratePdf = async (cycle: Cycle, ventes: any[]) => {
    setGeneratingPdf(true)
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF()

      const gold: [number, number, number] = [212, 168, 67]
      const black: [number, number, number] = [26, 26, 46]
      const gray: [number, number, number] = [150, 150, 150]
      const lightGray: [number, number, number] = [245, 245, 245]

      // EN-TETE
      doc.setFillColor(...black)
      doc.rect(0, 0, 210, 40, 'F')

      doc.setFontSize(22)
      doc.setTextColor(...gold)
      doc.setFont('helvetica', 'bold')
      doc.text('CJS', 20, 18)

      doc.setFontSize(9)
      doc.setTextColor(180, 180, 180)
      doc.setFont('helvetica', 'normal')
      doc.text('Cath Jewelry Store — Douala, Cameroun', 20, 26)
      doc.text('cathjewelry9@gmail.com | +237 651 207 853', 20, 32)

      doc.setFontSize(11)
      doc.setTextColor(...gold)
      doc.setFont('helvetica', 'bold')
      doc.text('RAPPORT FINANCIER', 210 - 20, 18, { align: 'right' })

      doc.setFontSize(9)
      doc.setTextColor(180, 180, 180)
      doc.setFont('helvetica', 'normal')
      doc.text(`Cycle : ${fmtDate(cycle.start_date)} — ${fmtDate(cycle.end_date || '')}`, 210 - 20, 26, { align: 'right' })
      doc.text(`Genere le ${new Date().toLocaleDateString('fr-FR')}`, 210 - 20, 32, { align: 'right' })

      let y = 52

      // RECAP FINANCIER
      doc.setFontSize(11)
      doc.setTextColor(...black)
      doc.setFont('helvetica', 'bold')
      doc.text('Recapitulatif financier', 20, y)
      y += 2

      doc.setDrawColor(...gold)
      doc.setLineWidth(0.5)
      doc.line(20, y + 2, 190, y + 2)
      y += 8

      const stats = [
        ['CA Brut', fmt(cycle.ca_brut) + ' FCFA', false],
        ['CA Net', fmt(cycle.ca_net) + ' FCFA', false],
        ['Cout de revient', fmt(cycle.cout_revient) + ' FCFA', false],
        ['Marge Brute', fmt(cycle.marge_brute) + ' FCFA', false],
        ['Charges Fixes', fmt(cycle.charges_fixes_total) + ' FCFA', false],
        ['Marge Nette', fmt(cycle.benefice_net) + ' FCFA', true],
      ]

      stats.forEach(([label, value, isBold], i) => {
        if (i % 2 === 0) {
          doc.setFillColor(...lightGray)
          doc.rect(18, y - 4, 174, 10, 'F')
        }
        doc.setFontSize(10)
        doc.setTextColor(...gray)
        doc.setFont('helvetica', 'normal')
        doc.text(label as string, 22, y + 2)

        doc.setTextColor(isBold ? ...[16, 185, 129] as [number, number, number] : ...black as [number, number, number])
        doc.setFont('helvetica', 'bold')
        doc.text(value as string, 188, y + 2, { align: 'right' })
        y += 10
      })

      y += 8

      // REPARTITION si disponible
      if (cycle.benefice_net > 0) {
        doc.setFontSize(11)
        doc.setTextColor(...black)
        doc.setFont('helvetica', 'bold')
        doc.text('Repartition de la marge nette', 20, y)
        y += 2
        doc.setDrawColor(...gold)
        doc.line(20, y + 2, 190, y + 2)
        y += 8

        repartition.forEach((r, i) => {
          const val = Math.round(cycle.benefice_net * r.percentage / 100)
          if (i % 2 === 0) {
            doc.setFillColor(...lightGray)
            doc.rect(18, y - 4, 174, 10, 'F')
          }
          doc.setFontSize(10)
          doc.setTextColor(...gray)
          doc.setFont('helvetica', 'normal')
          doc.text(`${r.name} (${r.percentage}%)`, 22, y + 2)
          doc.setTextColor(...gold)
          doc.setFont('helvetica', 'bold')
          doc.text(fmt(val) + ' FCFA', 188, y + 2, { align: 'right' })
          y += 10
        })
        y += 8
      }

      // VENTES
      if (ventes.length > 0) {
        // Nouvelle page si besoin
        if (y > 220) { doc.addPage(); y = 20 }

        doc.setFontSize(11)
        doc.setTextColor(...black)
        doc.setFont('helvetica', 'bold')
        doc.text(`Detail des ventes (${ventes.length})`, 20, y)
        y += 2
        doc.setDrawColor(...gold)
        doc.line(20, y + 2, 190, y + 2)
        y += 10

        // Header tableau
        doc.setFillColor(...black)
        doc.rect(18, y - 5, 174, 9, 'F')
        doc.setFontSize(8)
        doc.setTextColor(200, 200, 200)
        doc.setFont('helvetica', 'bold')
        doc.text('Date', 22, y)
        doc.text('Source', 60, y)
        doc.text('Client', 90, y)
        doc.text('Articles', 145, y)
        doc.text('Total', 188, y, { align: 'right' })
        y += 8

        ventes.forEach((v, i) => {
          if (y > 270) {
            doc.addPage()
            y = 20
            // Répéter header
            doc.setFillColor(...black)
            doc.rect(18, y - 5, 174, 9, 'F')
            doc.setFontSize(8)
            doc.setTextColor(200, 200, 200)
            doc.setFont('helvetica', 'bold')
            doc.text('Date', 22, y)
            doc.text('Source', 60, y)
            doc.text('Client', 90, y)
            doc.text('Articles', 145, y)
            doc.text('Total', 188, y, { align: 'right' })
            y += 8
          }

          if (i % 2 === 0) {
            doc.setFillColor(...lightGray)
            doc.rect(18, y - 4, 174, 8, 'F')
          }

          doc.setFontSize(8)
          doc.setTextColor(...black)
          doc.setFont('helvetica', 'normal')
          doc.text(new Date(v.created_at).toLocaleDateString('fr-FR'), 22, y)

          doc.setTextColor(v.source === 'site' ? ...[59, 130, 246] as [number, number, number] : ...[100, 100, 100] as [number, number, number])
          doc.text(v.source === 'site' ? 'Site' : 'Boutique', 60, y)

          doc.setTextColor(...black)
          const clientName = (v.customer_name || v.customer?.full_name || 'Anonyme').substring(0, 22)
          doc.text(clientName, 90, y)

          doc.text(String((v.sale_items || v.items || []).length) + ' art.', 145, y)

          doc.setTextColor(...gold)
          doc.setFont('helvetica', 'bold')
          doc.text(fmt(v.total) + ' F', 188, y, { align: 'right' })
          y += 8
        })

        // Total ventes
        y += 4
        doc.setDrawColor(...gold)
        doc.line(100, y, 190, y)
        y += 6
        doc.setFontSize(10)
        doc.setTextColor(...black)
        doc.setFont('helvetica', 'bold')
        doc.text('Total', 145, y)
        doc.setTextColor(...gold)
        doc.text(fmt(ventes.reduce((s, v) => s + v.total, 0)) + ' FCFA', 188, y, { align: 'right' })
      }

      // FOOTER sur chaque page
      const pageCount = doc.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFillColor(...black)
        doc.rect(0, 285, 210, 12, 'F')
        doc.setFontSize(8)
        doc.setTextColor(150, 150, 150)
        doc.setFont('helvetica', 'normal')
        doc.text('Cath Jewelry Store — Des bijoux qui ne ternissent pas', 20, 292)
        doc.text(`Page ${i}/${pageCount}`, 190, 292, { align: 'right' })
      }

      const filename = `CJS-rapport-${cycle.start_date}-${cycle.end_date || 'actuel'}.pdf`
      doc.save(filename)
      showToast('PDF genere avec succes')
    } catch (err) {
      console.error(err)
      showToast('Erreur lors de la generation du PDF')
    }
    setGeneratingPdf(false)
  }

  if (loading) return <div className="p-6 text-stone-400 text-sm">Chargement...</div>

  return (
    <div style={{ fontFamily: "'Sora', sans-serif", background: '#f8f8f8', minHeight: '100vh', color: '#1a1a2e' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        .mono { font-family: 'JetBrains Mono', monospace; }
        .kpi-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 14px; }
        .charges-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px,1fr)); gap: 12px; margin-bottom: 16px; }
        .rep-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px,1fr)); gap: 12px; }
        @media (max-width: 900px) { .kpi-grid { grid-template-columns: repeat(2,1fr); } .charges-grid { grid-template-columns: repeat(2,1fr); } .rep-grid { grid-template-columns: repeat(2,1fr); } }
        @media (max-width: 600px) { .kpi-grid { grid-template-columns: repeat(2,1fr); } .charges-grid { grid-template-columns: repeat(2,1fr); } .rep-grid { grid-template-columns: 1fr 1fr; } }
        .charge-item { position: relative; }
        .charge-edit-btn { position: absolute; top: 8px; right: 8px; opacity: 0; transition: opacity .2s; background: none; border: none; cursor: pointer; color: #d4a843; }
        .charge-item:hover .charge-edit-btn { opacity: 1; }
        .rep-item { position: relative; }
        .rep-edit-btn { position: absolute; top: 8px; right: 8px; opacity: 0; transition: opacity .2s; background: none; border: none; cursor: pointer; color: #d4a843; }
        .rep-item:hover .rep-edit-btn { opacity: 1; }
        .kpi-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: var(--accent, #d4a843); border-radius: 12px 12px 0 0; }
        .btn-gold { background: linear-gradient(135deg, #d4a843, #b8881e); color: #000; font-weight: 600; border: none; padding: 9px 18px; border-radius: 8px; cursor: pointer; font-family: 'Sora',sans-serif; font-size: 13px; display: inline-flex; align-items: center; gap: 7px; transition: all .2s; }
        .btn-gold:hover { opacity: .9; transform: translateY(-1px); }
        .btn-ghost { background: white; color: #666; border: 1px solid #e0e0e0; padding: 7px 14px; border-radius: 8px; cursor: pointer; font-family: 'Sora',sans-serif; font-size: 12px; display: inline-flex; align-items: center; gap: 6px; transition: all .2s; }
        .btn-ghost:hover { border-color: #aaa; color: #333; }
        .btn-danger { background: #fff0f0; color: #e53e3e; border: 1px solid #fca5a5; padding: 7px 14px; border-radius: 8px; cursor: pointer; font-family: 'Sora',sans-serif; font-size: 12px; display: inline-flex; align-items: center; gap: 6px; }
        .btn-danger:hover { background: #fee2e2; }
        .form-input { background: #f9f9f9; border: 1px solid #e0e0e0; border-radius: 8px; padding: 9px 13px; color: #1a1a2e; font-family: 'Sora',sans-serif; font-size: 13px; outline: none; width: 100%; transition: border-color .2s; }
        .form-input:focus { border-color: #d4a843; }
        .section-card { background: white; border: 1px solid #eee; border-radius: 14px; overflow: hidden; box-shadow: 0 1px 8px rgba(0,0,0,.04); }
        .section-header { padding: 16px 22px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #f0f0f0; }
        .section-body { padding: 20px 22px; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.5); display: flex; align-items: center; justify-content: center; z-index: 200; backdrop-filter: blur(4px); padding: 16px; }
        .modal { background: white; border-radius: 18px; padding: 28px; width: 100%; max-width: 480px; box-shadow: 0 20px 60px rgba(0,0,0,.15); max-height: 90vh; overflow-y: auto; }
        .detail-modal { max-width: 700px; }
        .detail-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .detail-table th { text-align: left; padding: 8px 10px; color: #888; font-weight: 500; font-size: 11px; border-bottom: 1px solid #f0f0f0; }
        .detail-table td { padding: 9px 10px; border-bottom: 1px solid #f5f5f5; }
        .detail-table tr:hover td { background: #fafafa; }
        .pulse { width: 7px; height: 7px; border-radius: 50%; background: #10b981; animation: pulse 1.8s infinite; display: inline-block; }
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(.8)} }
        .toast { position: fixed; bottom: 24px; right: 24px; background: #1a1a2e; color: white; border-radius: 10px; padding: 12px 20px; font-size: 13px; display: flex; align-items: center; gap: 10px; z-index: 300; box-shadow: 0 4px 20px rgba(0,0,0,.2); }
        .cycle-row { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; background: #fafafa; border: 1px solid #eee; border-radius: 8px; padding: 16px 20px; }
        .cycle-stats { display: flex; gap: 20px; flex: 1; flex-wrap: wrap; }
      `}</style>

      {/* TOPBAR */}
      <div style={{ background: 'white', borderBottom: '1px solid #eee', padding: '18px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
        <div>
          <div style={{ fontSize: '20px', fontWeight: 700 }}>Finance</div>
          <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>Vue d'ensemble · Douala, Cameroun (FCFA)</div>
        </div>
        <button className="btn-gold" onClick={() => setShowClotureModal(true)}>
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} width={15} height={15}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          Cloturer cycle
        </button>
      </div>

      <div style={{ padding: '24px', maxWidth: '1100px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* CYCLE BANNER */}
        <div style={{ background: 'white', border: '1px solid #eee', borderRadius: '14px', padding: '20px 24px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', boxShadow: '0 1px 8px rgba(0,0,0,.04)', flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#ecfdf5', color: '#10b981', border: '1px solid #a7f3d0', borderRadius: '20px', padding: '4px 12px', fontSize: '11px', fontWeight: 600, marginBottom: '8px' }}>
              <span className="pulse" /> Cycle Actuel
            </div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#d4a843', marginBottom: '4px' }}>
              Depuis le {activeCycle ? fmtDate(activeCycle.start_date) : fmtDate(new Date().toISOString())}
            </div>
            <div style={{ fontSize: '12px', color: '#888' }}>
              {closedCycles.length > 0 ? `Dernier cycle cloture le ${fmtDate(closedCycles[0].end_date || '')}` : 'Aucun cycle precedent'}
            </div>
            <div style={{ fontSize: '12px', color: '#888', marginTop: '10px', background: '#fafafa', borderRadius: '8px', padding: '8px 12px', borderLeft: '3px solid #d4a843', maxWidth: '500px' }}>
              Ventes boutique (payees) + commandes site (livrees) comptabilisees depuis le debut du cycle.
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div className="mono" style={{ fontSize: '40px', fontWeight: 700, color: '#1a1a2e' }}>{salesData.nb_ventes}</div>
            <div style={{ fontSize: '11px', color: '#888' }}>Ventes du cycle</div>
          </div>
        </div>

        {/* KPIs */}
        <div className="kpi-grid">
          {[
            { label: 'CA Brut', value: salesData.ca_brut, sub: 'FCFA', accent: '#d4a843', iconBg: 'rgba(212,168,67,.1)' },
            { label: 'CA Net', value: salesData.ca_net, sub: `Remises: ${fmt(salesData.ca_brut - salesData.ca_net)} FCFA`, accent: '#5e9ef0', iconBg: 'rgba(94,158,240,.1)' },
            { label: 'Marge Brute', value: margeBrute, sub: salesData.ca_net > 0 ? `${Math.round((margeBrute / salesData.ca_net) * 100)}% du CA net` : '—', accent: '#10b981', iconBg: 'rgba(16,185,129,.1)' },
            { label: 'Marge Nette', value: margeNette, sub: margeNette > 0 ? 'Apres charges fixes' : 'Charges non couvertes', accent: '#a084e8', iconBg: 'rgba(160,132,232,.1)' },
          ].map((kpi, i) => (
            <div key={i} className="kpi-card" style={{ background: 'white', border: '1px solid #eee', borderRadius: '14px', padding: '18px 20px', position: 'relative', overflow: 'hidden', boxShadow: '0 1px 8px rgba(0,0,0,.04)', ['--accent' as any]: kpi.accent } as any}>
              <div style={{ fontSize: '11px', color: '#888', fontWeight: 500, marginBottom: '10px' }}>{kpi.label}</div>
              <div className="mono" style={{ fontSize: '20px', fontWeight: 700, color: '#1a1a2e' }}>{fmt(kpi.value)}</div>
              <div style={{ fontSize: '10px', color: '#888', marginTop: '4px' }}>{kpi.sub}</div>
              <div style={{ position: 'absolute', top: '16px', right: '16px', width: '28px', height: '28px', borderRadius: '8px', background: kpi.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg fill="none" viewBox="0 0 24 24" stroke={kpi.accent} strokeWidth={2} width={14} height={14}><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
              </div>
            </div>
          ))}
        </div>

        {/* CHARGES FIXES */}
        <div className="section-card">
          <div className="section-header">
            <div style={{ fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg fill="none" viewBox="0 0 24 24" stroke="#d4a843" strokeWidth={2} width={16} height={16}><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
              Charges Fixes
            </div>
            <button className="btn-ghost" onClick={() => setShowAddCharge(!showAddCharge)}>
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} width={13} height={13}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Ajouter
            </button>
          </div>
          <div className="section-body">
            {charges.length === 0 ? (
              <p style={{ color: '#aaa', fontSize: '13px', textAlign: 'center', padding: '16px 0' }}>Aucune charge definie</p>
            ) : (
              <div className="charges-grid">
                {charges.map(c => (
                  <div key={c.id} className="charge-item" style={{ background: '#fafafa', border: '1px solid #eee', borderRadius: '8px', padding: '14px 16px' }}>
                    <div style={{ fontSize: '11px', color: '#888', fontWeight: 500 }}>{c.name}</div>
                    <div className="mono" style={{ fontSize: '16px', fontWeight: 700, marginTop: '4px' }}>
                      {fmt(c.amount)} <span style={{ fontSize: '11px', fontWeight: 400, color: '#aaa' }}>FCFA</span>
                    </div>
                    <button className="charge-edit-btn" onClick={() => { setEditingCharge(c); setEditChargeForm({ name: c.name, amount: c.amount }); setShowEditChargeModal(true) }}>
                      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} width={12} height={12}><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ background: '#fff0f0', border: '1px solid #fca5a5', borderRadius: '8px', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', color: '#e53e3e', fontWeight: 500 }}>Total Charges Fixes</span>
              <span className="mono" style={{ fontSize: '18px', fontWeight: 700, color: '#e53e3e' }}>{fmt(totalCharges)} FCFA</span>
            </div>
            {margeBrute > 0 && (
              <div style={{ marginTop: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#aaa', marginBottom: '4px' }}>
                  <span>Saturation des charges</span>
                  <span>{Math.min(100, Math.round((totalCharges / margeBrute) * 100))}%</span>
                </div>
                <div style={{ height: '6px', background: '#f0f0f0', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: totalCharges > margeBrute ? '#e53e3e' : '#d4a843', borderRadius: '3px', width: `${Math.min(100, (totalCharges / margeBrute) * 100)}%`, transition: 'width .5s' }} />
                </div>
                {totalCharges > margeBrute && <p style={{ fontSize: '11px', color: '#e53e3e', marginTop: '4px' }}>Les charges depassent la marge brute</p>}
              </div>
            )}
            {showAddCharge && (
              <div style={{ marginTop: '14px', background: '#fafafa', padding: '14px', borderRadius: '8px', border: '1px dashed #ddd', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <input className="form-input" style={{ flex: 1, minWidth: '140px' }} placeholder="Nom (ex: Salaire, Loyer...)" value={chargeForm.name} onChange={e => setChargeForm({ ...chargeForm, name: e.target.value })} />
                <input className="form-input" style={{ flex: 1, minWidth: '120px' }} type="number" placeholder="Montant FCFA" value={chargeForm.amount || ''} onChange={e => setChargeForm({ ...chargeForm, amount: Number(e.target.value) })} />
                <button className="btn-gold" onClick={handleAddCharge}>Ajouter</button>
              </div>
            )}
          </div>
        </div>

        {/* REPARTITION */}
        <div className="section-card">
          <div className="section-header">
            <div style={{ fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg fill="none" viewBox="0 0 24 24" stroke="#d4a843" strokeWidth={2} width={16} height={16}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              Repartition Automatique
            </div>
            <button className="btn-ghost" onClick={() => setShowAddRep(!showAddRep)}>
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} width={13} height={13}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Ajouter
            </button>
          </div>
          <div className="section-body">
            <div style={{ background: 'rgba(212,168,67,.08)', border: '1px solid rgba(212,168,67,.2)', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: '#b8881e', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} width={14} height={14}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              Les charges fixes doivent etre couvertes AVANT la repartition sur la marge nette
            </div>
            <div style={{ background: '#f0faf6', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: '#555', fontFamily: "'JetBrains Mono', monospace", marginBottom: '16px', borderLeft: '3px solid #10b981' }}>
              {fmt(margeBrute)} - {fmt(totalCharges)} = <strong>{fmt(margeNette)} FCFA</strong> a repartir
            </div>
            {repartition.length === 0 ? (
              <p style={{ color: '#aaa', fontSize: '13px', textAlign: 'center', padding: '16px 0' }}>Aucune regle definie</p>
            ) : (
              <div className="rep-grid">
                {repartition.map(r => {
                  const val = Math.round(margeNette * r.percentage / 100)
                  return (
                    <div key={r.id} className="rep-item" style={{ background: '#fafafa', border: '1px solid #eee', borderRadius: '8px', padding: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <div style={{ fontSize: '12px', color: '#888', fontWeight: 500 }}>{r.name}</div>
                        <div style={{ fontSize: '11px', fontWeight: 700, background: 'rgba(212,168,67,.15)', color: '#d4a843', borderRadius: '4px', padding: '2px 7px' }}>{r.percentage}%</div>
                      </div>
                      <div className="mono" style={{ fontSize: '16px', fontWeight: 700, color: margeNette > 0 ? '#1a1a2e' : '#ccc' }}>
                        {fmt(val)} <span style={{ fontSize: '11px', fontWeight: 400, color: '#aaa' }}>FCFA</span>
                      </div>
                      <div style={{ height: '3px', background: '#eee', borderRadius: '2px', marginTop: '10px' }}>
                        <div style={{ height: '100%', background: '#d4a843', borderRadius: '2px', width: `${r.percentage}%` }} />
                      </div>
                      <button className="rep-edit-btn" onClick={() => { setEditingRep(r); setEditRepForm({ name: r.name, percentage: r.percentage }); setShowEditRepModal(true) }}>
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} width={12} height={12}><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
            <div style={{ marginTop: '12px', fontSize: '12px', fontWeight: 500, color: totalRepPct > 100 ? '#e53e3e' : totalRepPct === 100 ? '#10b981' : '#d4a843' }}>
              Total reparti : {totalRepPct}% {totalRepPct > 100 ? 'Depasse 100%' : totalRepPct === 100 ? 'Complet' : `(${100 - totalRepPct}% non affecte)`}
            </div>
            {showAddRep && (
              <div style={{ marginTop: '14px', background: '#fafafa', padding: '14px', borderRadius: '8px', border: '1px dashed #ddd', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <input className="form-input" style={{ flex: 1, minWidth: '140px' }} placeholder="Nom (ex: Epargne, Marketing...)" value={repForm.name} onChange={e => setRepForm({ ...repForm, name: e.target.value })} />
                <input className="form-input" style={{ flex: '0 0 100px' }} type="number" placeholder="%" min={1} max={100} value={repForm.percentage || ''} onChange={e => setRepForm({ ...repForm, percentage: Number(e.target.value) })} />
                <button className="btn-gold" onClick={handleAddRep}>Ajouter</button>
              </div>
            )}
          </div>
        </div>

        {/* HISTORIQUE CYCLES */}
        {closedCycles.length > 0 && (
          <div className="section-card">
            <div className="section-header">
              <div style={{ fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg fill="none" viewBox="0 0 24 24" stroke="#d4a843" strokeWidth={2} width={16} height={16}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                Cycles Clotures
                <span style={{ background: '#f0f0f0', color: '#888', borderRadius: '6px', padding: '1px 8px', fontSize: '12px', fontWeight: 400 }}>{closedCycles.length}</span>
              </div>
            </div>
            <div className="section-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {closedCycles.map(cycle => (
                  <div key={cycle.id} className="cycle-row">
                    <div style={{ flex: '0 0 auto', minWidth: '160px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 600 }}>{fmtDate(cycle.start_date)} — {fmtDate(cycle.end_date || '')}</div>
                      <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>Cloture le {fmtDate(cycle.end_date || '')}</div>
                    </div>
                    <div className="cycle-stats">
                      {[
                        { label: 'CA Brut', value: fmt(cycle.ca_brut) + ' F' },
                        { label: 'CA Net', value: fmt(cycle.ca_net) + ' F' },
                        { label: 'Marge Brute', value: fmt(cycle.marge_brute) + ' F' },
                        { label: 'Marge Nette', value: fmt(cycle.benefice_net) + ' F', green: true },
                      ].map((stat, i) => (
                        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <div style={{ fontSize: '10px', color: '#aaa', fontWeight: 500, textTransform: 'uppercase' }}>{stat.label}</div>
                          <div className="mono" style={{ fontSize: '13px', fontWeight: 700, color: stat.green ? '#10b981' : '#1a1a2e' }}>{stat.value}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexShrink: 0, flexWrap: 'wrap' }}>
                      <button className="btn-ghost" onClick={() => handleViewCycle(cycle)}>
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} width={13} height={13}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        Voir
                      </button>
                      <button className="btn-ghost" disabled={generatingPdf} onClick={async () => {
                        // Charger les ventes du cycle pour le PDF
                        const startISO = new Date(cycle.start_date).toISOString()
                        const endISO = cycle.end_date ? new Date(cycle.end_date + 'T23:59:59').toISOString() : new Date().toISOString()
                        const { data: boutique } = await supabase.from('sales').select('*, sale_items(*), customer:customers(full_name)').eq('shop_id', SHOP_ID).eq('status', 'paid').gte('created_at', startISO).lte('created_at', endISO)
                        const { data: site } = await supabase.from('orders').select('*').eq('shop_id', SHOP_ID).eq('status', 'livré').gte('created_at', startISO).lte('created_at', endISO)
                        const allVentes = [
                          ...(boutique || []).map(v => ({ ...v, source: 'boutique' })),
                          ...(site || []).map(v => ({ ...v, source: 'site', sale_items: v.items || [] })),
                        ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                        await handleGeneratePdf(cycle, allVentes)
                      }}>
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} width={13} height={13}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        {generatingPdf ? '...' : 'PDF'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL CLOTURE */}
      {showClotureModal && (
        <div className="modal-overlay" onClick={() => setShowClotureModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>Cloturer le cycle</div>
            <div style={{ fontSize: '13px', color: '#888', marginBottom: '16px', lineHeight: 1.6 }}>
              Les donnees du cycle seront archivees et un nouveau cycle demarrera immediatement.
            </div>
            <div style={{ background: '#fff0f0', border: '1px solid #fca5a5', borderRadius: '8px', padding: '12px 14px', fontSize: '12px', color: '#e53e3e', marginBottom: '16px', display: 'flex', gap: '8px' }}>
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} width={14} height={14} style={{ flexShrink: 0, marginTop: '1px' }}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              <span>Action <strong>irreversible</strong>. Verifiez que toutes les ventes sont enregistrees.</span>
            </div>
            <div style={{ background: '#fafafa', borderRadius: '8px', padding: '12px', marginBottom: '16px', fontSize: '12px' }}>
              {[['CA Brut', fmt(salesData.ca_brut) + ' FCFA'], ['Marge Brute', fmt(margeBrute) + ' FCFA'], ['Charges Fixes', fmt(totalCharges) + ' FCFA']].map(([l, v]) => (
                <div key={l} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: '#888' }}>{l}</span>
                  <span className="mono" style={{ fontWeight: 600 }}>{v}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid #eee', marginTop: '4px' }}>
                <span style={{ fontWeight: 600 }}>Marge Nette</span>
                <span className="mono" style={{ fontWeight: 700, color: margeNette > 0 ? '#10b981' : '#e53e3e' }}>{fmt(margeNette)} FCFA</span>
              </div>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '12px', color: '#888', display: 'block', marginBottom: '6px' }}>Tapez <strong>CONFIRMER</strong> pour valider :</label>
              <input className="form-input" placeholder="CONFIRMER" value={clotureConfirm} onChange={e => setClotureConfirm(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className="btn-ghost" onClick={() => { setShowClotureModal(false); setClotureConfirm('') }}>Annuler</button>
              <button className="btn-danger" disabled={clotureConfirm !== 'CONFIRMER' || saving} onClick={handleCloture}>
                {saving ? '...' : 'Cloturer definitivement'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDIT CHARGE */}
      {showEditChargeModal && editingCharge && (
        <div className="modal-overlay" onClick={() => setShowEditChargeModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>Modifier la charge</div>
            <input className="form-input" style={{ marginBottom: '10px' }} placeholder="Nom" value={editChargeForm.name} onChange={e => setEditChargeForm({ ...editChargeForm, name: e.target.value })} />
            <input className="form-input" style={{ marginBottom: '20px' }} type="number" placeholder="Montant FCFA" value={editChargeForm.amount || ''} onChange={e => setEditChargeForm({ ...editChargeForm, amount: Number(e.target.value) })} />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className="btn-danger" onClick={handleDeleteCharge}>Supprimer</button>
              <button className="btn-ghost" onClick={() => setShowEditChargeModal(false)}>Annuler</button>
              <button className="btn-gold" onClick={handleSaveCharge}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDIT REP */}
      {showEditRepModal && editingRep && (
        <div className="modal-overlay" onClick={() => setShowEditRepModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>Modifier la repartition</div>
            <input className="form-input" style={{ marginBottom: '10px' }} placeholder="Nom" value={editRepForm.name} onChange={e => setEditRepForm({ ...editRepForm, name: e.target.value })} />
            <input className="form-input" style={{ marginBottom: '6px' }} type="number" placeholder="%" min={1} max={100} value={editRepForm.percentage || ''} onChange={e => setEditRepForm({ ...editRepForm, percentage: Number(e.target.value) })} />
            <p style={{ fontSize: '11px', color: '#aaa', marginBottom: '20px' }}>Restant disponible : {100 - totalRepPct + editingRep.percentage}%</p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className="btn-danger" onClick={handleDeleteRep}>Supprimer</button>
              <button className="btn-ghost" onClick={() => setShowEditRepModal(false)}>Annuler</button>
              <button className="btn-gold" onClick={handleSaveRep}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETAIL CYCLE */}
      {showDetailModal && selectedCycle && (
        <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="modal detail-modal" onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>
              Cycle : {fmtDate(selectedCycle.start_date)} — {fmtDate(selectedCycle.end_date || '')}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '10px', marginBottom: '20px' }}>
              {[
                ['CA Brut', fmt(selectedCycle.ca_brut) + ' F'],
                ['CA Net', fmt(selectedCycle.ca_net) + ' F'],
                ['Marge Brute', fmt(selectedCycle.marge_brute) + ' F'],
                ['Charges', fmt(selectedCycle.charges_fixes_total) + ' F'],
                ['Marge Nette', fmt(selectedCycle.benefice_net) + ' F'],
              ].map(([l, v], i) => (
                <div key={i} style={{ background: '#fafafa', border: '1px solid #eee', borderRadius: '8px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '10px', color: '#aaa', marginBottom: '4px' }}>{l}</div>
                  <div className="mono" style={{ fontSize: '13px', fontWeight: 700, color: i === 4 && selectedCycle.benefice_net > 0 ? '#10b981' : '#1a1a2e' }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: '10px', paddingBottom: '6px', borderBottom: '1px solid #f0f0f0' }}>
              Ventes de la periode ({cycleVentes.length})
            </div>
            {cycleVentes.length === 0 ? (
              <p style={{ color: '#aaa', fontSize: '13px' }}>Aucune vente pour cette periode.</p>
            ) : (
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                <table className="detail-table">
                  <thead>
                    <tr><th>Date</th><th>Source</th><th>Client</th><th>Articles</th><th>Total</th></tr>
                  </thead>
                  <tbody>
                    {cycleVentes.map((v, i) => (
                      <tr key={i}>
                        <td>{new Date(v.created_at).toLocaleDateString('fr-FR')}</td>
                        <td>
                          <span style={{ fontSize: '10px', background: v.source === 'site' ? '#eff6ff' : '#f5f5f4', color: v.source === 'site' ? '#3b82f6' : '#666', padding: '2px 6px', borderRadius: '4px' }}>
                            {v.source === 'site' ? 'Site' : 'Boutique'}
                          </span>
                        </td>
                        <td>{v.customer_name || v.customer?.full_name || '—'}</td>
                        <td>{(v.sale_items || v.items || []).length} art.</td>
                        <td className="mono" style={{ fontWeight: 700 }}>{fmt(v.total)} F</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button className="btn-ghost" disabled={generatingPdf} onClick={() => handleGeneratePdf(selectedCycle, cycleVentes)}>
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} width={13} height={13}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                {generatingPdf ? 'Generation...' : 'Telecharger PDF'}
              </button>
              <button className="btn-ghost" onClick={() => setShowDetailModal(false)}>Fermer</button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast && (
        <div className="toast">
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
          {toast}
        </div>
      )}
    </div>
  )
}