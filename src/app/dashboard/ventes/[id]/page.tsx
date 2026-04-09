'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Printer, Send, X, Plus, Trash2, Search } from 'lucide-react'

type Sale = {
  id: string
  status: string
  total: number
  subtotal: number
  discount_amount: number
  discount_type?: string
  discount_value: number
  customer_name?: string
  acquisition_source?: string
  payment_method?: string
  notes?: string
  paid_at?: string
  created_at: string
  customer?: { id: string; full_name: string; phone?: string }
  employee?: { full_name: string }
  sale_items: {
    id: string
    product_name: string
    variant_name?: string
    quantity: number
    unit_price: number
    unit_cost: number
    total_price: number
    variant_id?: string
    product_id?: string
  }[]
}

type Variant = {
  id: string
  name: string
  sale_price: number
  cost_price: number
  stock_quantity: number
  barcode?: string
  product: { id: string; name: string }
}

const SHOP_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

export default function VenteDetailPage() {
  const supabase = createClient()
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [sale, setSale] = useState<Sale | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [showReceiptModal, setShowReceiptModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [allVariants, setAllVariants] = useState<Variant[]>([])
  const [showProductSearch, setShowProductSearch] = useState(false)
  const [productSearch, setProductSearch] = useState('')

  // Edit form
  const [editCart, setEditCart] = useState<Sale['sale_items']>([])
  const [editCustomerName, setEditCustomerName] = useState('')
  const [editSource, setEditSource] = useState('')
  const [editPayment, setEditPayment] = useState('')
  const [editDiscountType, setEditDiscountType] = useState('')
  const [editDiscountValue, setEditDiscountValue] = useState(0)
  const [editNotes, setEditNotes] = useState('')
  const [editReason, setEditReason] = useState('')

  const fetchSale = async () => {
    const { data } = await supabase
      .from('sales')
      .select('*, customer:customers(id, full_name, phone), employee:employees(full_name), sale_items(*)')
      .eq('id', id)
      .single()
    setSale(data)
    setLoading(false)
  }

  const fetchVariants = async () => {
    const { data } = await supabase
      .from('variants')
      .select('*, product:products(id, name)')
      .eq('shop_id', SHOP_ID)
      .eq('is_active', true)
    setAllVariants(data || [])
  }

  useEffect(() => {
    fetchSale()
    fetchVariants()
  }, [id])

  const canEdit = () => {
    if (!sale || sale.status !== 'paid' || !sale.paid_at) return false
    const paidAt = new Date(sale.paid_at)
    const now = new Date()
    const diffHours = (now.getTime() - paidAt.getTime()) / (1000 * 60 * 60)
    return diffHours <= 48
  }

  const openEditModal = () => {
    if (!sale) return
    setEditCart(sale.sale_items.map(i => ({ ...i })))
    setEditCustomerName(sale.customer?.full_name || sale.customer_name || '')
    setEditSource(sale.acquisition_source || '')
    setEditPayment(sale.payment_method || '')
    setEditDiscountType(sale.discount_type || '')
    setEditDiscountValue(sale.discount_value || 0)
    setEditNotes(sale.notes || '')
    setEditReason('')
    setShowEditModal(true)
  }

  const addToEditCart = (variant: Variant) => {
    const existing = editCart.find(i => i.variant_id === variant.id)
    if (existing) {
      setEditCart(editCart.map(i =>
        i.variant_id === variant.id ? { ...i, quantity: i.quantity + 1 } : i
      ))
    } else {
      setEditCart([...editCart, {
        id: '',
        variant_id: variant.id,
        product_id: variant.product.id,
        product_name: variant.product.name,
        variant_name: variant.name,
        quantity: 1,
        unit_price: variant.sale_price,
        unit_cost: variant.cost_price,
        total_price: variant.sale_price,
      }])
    }
    setShowProductSearch(false)
    setProductSearch('')
  }

  const updateEditQty = (variant_id: string, qty: number) => {
    if (qty <= 0) {
      setEditCart(editCart.filter(i => i.variant_id !== variant_id))
    } else {
      setEditCart(editCart.map(i => i.variant_id === variant_id ? { ...i, quantity: qty } : i))
    }
  }

  const editSubtotal = editCart.reduce((sum, i) => sum + i.unit_price * i.quantity, 0)
  const editDiscountAmount = editDiscountType === 'fixed'
    ? editDiscountValue
    : editDiscountType === 'percent'
    ? (editSubtotal * editDiscountValue) / 100
    : 0
  const editTotal = editSubtotal - editDiscountAmount

  const handleSaveEdit = async () => {
    if (!editReason.trim()) {
      setError('Le motif de modification est obligatoire')
      return
    }
    if (editCart.length === 0) {
      setError('La vente doit contenir au moins un article')
      return
    }
    setSaving(true)
    setError('')

    // Mettre à jour la vente
    await supabase
      .from('sales')
      .update({
        customer_name: editCustomerName || null,
        acquisition_source: editSource || null,
        payment_method: editPayment || null,
        subtotal: editSubtotal,
        discount_type: editDiscountType || null,
        discount_value: editDiscountValue,
        discount_amount: editDiscountAmount,
        total: editTotal,
        notes: `${editNotes ? editNotes + ' | ' : ''}MODIFIÉ — Motif: ${editReason}`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    // Supprimer les anciens articles
    await supabase.from('sale_items').delete().eq('sale_id', id)

    // Réinsérer les nouveaux articles
    await supabase.from('sale_items').insert(
      editCart.map(item => ({
        sale_id: id,
        variant_id: item.variant_id || null,
        product_id: item.product_id || null,
        product_name: item.product_name,
        variant_name: item.variant_name || null,
        quantity: item.quantity,
        unit_price: item.unit_price,
        unit_cost: item.unit_cost,
        total_price: item.unit_price * item.quantity,
      }))
    )

    // Log
    await supabase.from('logs').insert({
      shop_id: SHOP_ID,
      action: `Vente modifiée sous 48h — Motif: ${editReason}`,
      module: 'ventes',
      reference_id: id,
    })

    setSaving(false)
    setShowEditModal(false)
    fetchSale()
  }

  const handleStatusChange = async (newStatus: string) => {
    if (!sale) return
    setSaving(true)

    await supabase
      .from('sales')
      .update({
        status: newStatus,
        paid_at: newStatus === 'paid' ? new Date().toISOString() : sale.paid_at,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sale.id)

    await supabase.from('logs').insert({
      shop_id: SHOP_ID,
      action: `Changement statut vente: ${sale.status} → ${newStatus}`,
      module: 'ventes',
      reference_id: sale.id,
    })

    setSaving(false)
    fetchSale()

    if (newStatus === 'paid') {
      setShowReceiptModal(true)
    }
  }

  const handleCancel = async () => {
    if (!cancelReason.trim()) {
      setError('Le motif est obligatoire')
      return
    }
    setSaving(true)

    await supabase
      .from('sales')
      .update({
        status: 'cancelled',
        notes: `ANNULÉ — Motif: ${cancelReason}${sale?.notes ? ` | ${sale.notes}` : ''}`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    await supabase.from('logs').insert({
      shop_id: SHOP_ID,
      action: `Vente annulée — Motif: ${cancelReason}`,
      module: 'ventes',
      reference_id: id,
    })

    setSaving(false)
    setShowCancelModal(false)
    fetchSale()
  }

  const handlePrint = () => window.print()

  const handleWhatsApp = () => {
    if (!sale) return
    const customerPhone = sale.customer?.phone
    const msg = encodeURIComponent(
      `Reçu CJS — ${new Date(sale.created_at).toLocaleDateString('fr-FR')}\n` +
      `Client: ${sale.customer?.full_name || sale.customer_name || 'Anonyme'}\n` +
      sale.sale_items.map(i =>
        `• ${i.product_name} ${i.variant_name || ''} x${i.quantity} = ${formatFCFA(i.total_price)}`
      ).join('\n') +
      `\nTotal: ${formatFCFA(sale.total)}\nMerci pour votre achat !`
    )
    const url = customerPhone
      ? `https://wa.me/${customerPhone.replace(/\D/g, '')}?text=${msg}`
      : `https://wa.me/?text=${msg}`
    window.open(url, '_blank')
  }

  const formatFCFA = (amount: number) =>
    new Intl.NumberFormat('fr-FR').format(Math.round(amount)) + ' FCFA'

  const statusLabel: Record<string, string> = {
    draft: 'Brouillon',
    in_delivery: 'En livraison',
    paid: 'Payée',
    cancelled: 'Annulée',
  }

  const statusColor: Record<string, string> = {
    draft: 'bg-stone-100 text-stone-600',
    in_delivery: 'bg-blue-100 text-blue-600',
    paid: 'bg-green-100 text-green-600',
    cancelled: 'bg-red-100 text-red-500',
  }

  const filteredVariants = allVariants.filter(v =>
    v.product.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    v.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    v.barcode?.includes(productSearch)
  )

  if (loading) return <div className="p-6 text-stone-400">Chargement...</div>
  if (!sale) return <div className="p-6 text-stone-400">Vente introuvable</div>

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-2 hover:bg-stone-100 rounded-lg">
          <ArrowLeft size={18} className="text-stone-600" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-stone-800">Vente</h1>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[sale.status]}`}>
              {statusLabel[sale.status]}
            </span>
          </div>
          <p className="text-stone-500 text-sm">
            {new Date(sale.created_at).toLocaleDateString('fr-FR')} à{' '}
            {new Date(sale.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>

        <div className="flex gap-2">
          {sale.status === 'draft' && (
            <>
              <button
                onClick={() => handleStatusChange('in_delivery')}
                disabled={saving}
                className="border border-blue-300 hover:bg-blue-50 text-blue-600 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                → En livraison
              </button>
              <button
                onClick={() => { setCancelReason(''); setError(''); setShowCancelModal(true) }}
                className="border border-red-300 hover:bg-red-50 text-red-500 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Annuler
              </button>
            </>
          )}
          {sale.status === 'in_delivery' && (
            <>
              <button
                onClick={() => handleStatusChange('paid')}
                disabled={saving}
                className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Marquer payée
              </button>
              <button
                onClick={() => { setCancelReason(''); setError(''); setShowCancelModal(true) }}
                className="border border-red-300 hover:bg-red-50 text-red-500 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Annuler
              </button>
            </>
          )}
          {sale.status === 'paid' && (
            <>
              <button
                onClick={() => setShowReceiptModal(true)}
                className="flex items-center gap-2 border border-stone-300 hover:bg-stone-50 text-stone-600 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <Printer size={14} />
                Reçu
              </button>
              {canEdit() && (
                <button
                  onClick={openEditModal}
                  className="border border-yellow-300 hover:bg-yellow-50 text-yellow-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Modifier (48h)
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Infos */}
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <h2 className="font-semibold text-stone-700 mb-3">Client</h2>
          <p className="font-medium text-stone-800">
            {sale.customer?.full_name || sale.customer_name || 'Client anonyme'}
          </p>
          {sale.customer?.phone && (
            <p className="text-sm text-stone-400 mt-1">{sale.customer.phone}</p>
          )}
          {sale.acquisition_source && (
            <p className="text-xs text-stone-400 mt-2">Source : {sale.acquisition_source}</p>
          )}
          {sale.payment_method && (
            <p className="text-xs text-stone-400 mt-1">Paiement : {sale.payment_method}</p>
          )}
          {sale.employee && (
            <p className="text-xs text-stone-400 mt-1">Vendeur : {sale.employee.full_name}</p>
          )}
          {sale.notes && (
            <p className="text-xs text-stone-500 mt-3 italic">{sale.notes}</p>
          )}
          {sale.status === 'paid' && sale.paid_at && (
            <div className="mt-3 pt-3 border-t border-stone-100">
              {canEdit() ? (
                <p className="text-xs text-green-600">✓ Modifiable encore</p>
              ) : (
                <p className="text-xs text-stone-400">Non modifiable (plus de 48h)</p>
              )}
            </div>
          )}
        </div>

        {/* Articles */}
        <div className="col-span-2 bg-white rounded-xl p-5 shadow-sm">
          <h2 className="font-semibold text-stone-700 mb-3">Articles</h2>
          <div className="space-y-2 mb-4">
            {sale.sale_items.map((item) => (
              <div key={item.id} className="flex items-center justify-between bg-stone-50 rounded-lg px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-stone-700">{item.product_name}</p>
                  {item.variant_name && (
                    <p className="text-xs text-stone-400">{item.variant_name}</p>
                  )}
                </div>
                <div className="flex gap-6 text-right">
                  <span className="text-sm text-stone-400">x{item.quantity}</span>
                  <span className="text-sm text-stone-500">{formatFCFA(item.unit_price)}</span>
                  <span className="text-sm font-bold text-stone-800">{formatFCFA(item.total_price)}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-stone-100 pt-3 space-y-1">
            <div className="flex justify-between text-sm text-stone-500">
              <span>Sous-total</span>
              <span>{formatFCFA(sale.subtotal)}</span>
            </div>
            {sale.discount_amount > 0 && (
              <div className="flex justify-between text-sm text-red-400">
                <span>Réduction</span>
                <span>-{formatFCFA(sale.discount_amount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-stone-800 text-lg">
              <span>Total</span>
              <span>{formatFCFA(sale.total)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Modal annulation */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-stone-800">Annuler la vente</h2>
              <button onClick={() => setShowCancelModal(false)}>
                <X size={18} className="text-stone-400" />
              </button>
            </div>
            <p className="text-sm text-stone-500 mb-3">Le motif est obligatoire.</p>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Motif de l'annulation..."
              rows={3}
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 mb-3"
            />
            {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
            <div className="flex gap-3">
              <button
                onClick={handleCancel}
                disabled={saving}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {saving ? '...' : 'Confirmer l\'annulation'}
              </button>
              <button
                onClick={() => { setShowCancelModal(false); setError('') }}
                className="px-4 py-2 text-stone-600 hover:bg-stone-100 rounded-lg text-sm"
              >
                Retour
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal modification 48h */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-stone-800">Modifier la vente</h2>
              <button onClick={() => setShowEditModal(false)}>
                <X size={18} className="text-stone-400" />
              </button>
            </div>

            {/* Motif obligatoire */}
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <label className="block text-sm font-medium text-amber-700 mb-1">
                Motif de modification *
              </label>
              <input
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                placeholder="Ex: Erreur de produit, demande client..."
                className="w-full border border-amber-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs text-stone-500 mb-1">Client</label>
                <input
                  value={editCustomerName}
                  onChange={(e) => setEditCustomerName(e.target.value)}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </div>
              <div>
                <label className="block text-xs text-stone-500 mb-1">Source</label>
                <select
                  value={editSource}
                  onChange={(e) => setEditSource(e.target.value)}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                >
                  <option value="">Sélectionner...</option>
                  {['TikTok','WhatsApp','Facebook','Instagram','Boutique','Recommandation','Autre'].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-stone-500 mb-1">Paiement</label>
                <input
                  value={editPayment}
                  onChange={(e) => setEditPayment(e.target.value)}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </div>
              <div>
                <label className="block text-xs text-stone-500 mb-1">Type réduction</label>
                <select
                  value={editDiscountType}
                  onChange={(e) => setEditDiscountType(e.target.value)}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                >
                  <option value="">Aucune</option>
                  <option value="fixed">Montant fixe</option>
                  <option value="percent">Pourcentage</option>
                </select>
              </div>
              {editDiscountType && (
                <div>
                  <label className="block text-xs text-stone-500 mb-1">
                    Valeur {editDiscountType === 'percent' ? '(%)' : '(FCFA)'}
                  </label>
                  <input
                    type="number"
                    value={editDiscountValue}
                    onChange={(e) => setEditDiscountValue(Number(e.target.value))}
                    className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  />
                </div>
              )}
              <div className="col-span-2">
                <label className="block text-xs text-stone-500 mb-1">Notes</label>
                <input
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </div>
            </div>

            {/* Articles */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-stone-700">Articles</h3>
                <button
                  onClick={() => setShowProductSearch(true)}
                  className="flex items-center gap-1 text-xs text-yellow-600 border border-yellow-300 px-2 py-1 rounded-lg"
                >
                  <Plus size={12} /> Ajouter
                </button>
              </div>

              {showProductSearch && (
                <div className="mb-3">
                  <input
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Rechercher un produit..."
                    autoFocus
                    className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 mb-2"
                  />
                  <div className="max-h-40 overflow-y-auto border border-stone-200 rounded-lg">
                    {filteredVariants.map(v => (
                      <button
                        key={v.id}
                        onClick={() => addToEditCart(v)}
                        className="w-full flex items-center justify-between px-3 py-2 hover:bg-stone-50 text-left"
                      >
                        <div>
                          <p className="text-sm font-medium text-stone-700">{v.product.name}</p>
                          <p className="text-xs text-stone-400">{v.name}</p>
                        </div>
                        <span className="text-sm font-bold text-stone-700">{formatFCFA(v.sale_price)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {editCart.map((item, index) => (
                  <div key={index} className="flex items-center gap-3 bg-stone-50 rounded-lg px-3 py-2">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-stone-700">{item.product_name}</p>
                      <p className="text-xs text-stone-400">{item.variant_name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateEditQty(item.variant_id || '', item.quantity - 1)}
                        className="w-6 h-6 rounded-full bg-stone-200 hover:bg-stone-300 flex items-center justify-center text-sm"
                      >-</button>
                      <span className="text-sm font-medium w-4 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateEditQty(item.variant_id || '', item.quantity + 1)}
                        className="w-6 h-6 rounded-full bg-stone-200 hover:bg-stone-300 flex items-center justify-center text-sm"
                      >+</button>
                    </div>
                    <p className="text-sm font-bold text-stone-800 w-24 text-right">
                      {formatFCFA(item.unit_price * item.quantity)}
                    </p>
                    <button
                      onClick={() => setEditCart(editCart.filter((_, i) => i !== index))}
                      className="text-red-400 hover:text-red-500"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-3 pt-3 border-t border-stone-100">
                <div className="flex justify-between font-bold text-stone-800">
                  <span>Nouveau total</span>
                  <span>{formatFCFA(editTotal)}</span>
                </div>
              </div>
            </div>

            {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

            <div className="flex gap-3">
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
              </button>
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 text-stone-600 hover:bg-stone-100 rounded-lg text-sm"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal reçu */}
      {showReceiptModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-stone-800">Reçu de vente</h2>
              <button onClick={() => setShowReceiptModal(false)}>
                <X size={18} className="text-stone-400" />
              </button>
            </div>

            <div className="border border-stone-200 rounded-xl p-4 mb-4">
              <div className="text-center mb-3">
                <p className="font-bold text-stone-800">CATH JEWELRY STORE</p>
                <p className="text-xs text-stone-400">Bonamoussadi Douala</p>
                <p className="text-xs text-stone-400">651207853</p>
              </div>
              <div className="border-t border-dashed border-stone-200 pt-2 mb-2">
                <p className="text-xs text-stone-500">
                  Date : {new Date(sale.created_at).toLocaleDateString('fr-FR')}
                </p>
                <p className="text-xs text-stone-500">
                  Client : {sale.customer?.full_name || sale.customer_name || 'Anonyme'}
                </p>
              </div>
              <div className="border-t border-dashed border-stone-200 pt-2 mb-2 space-y-1">
                {sale.sale_items.map((item) => (
                  <div key={item.id} className="flex justify-between text-xs">
                    <span>{item.product_name} {item.variant_name} x{item.quantity}</span>
                    <span>{formatFCFA(item.total_price)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-dashed border-stone-200 pt-2">
                {sale.discount_amount > 0 && (
                  <div className="flex justify-between text-xs text-red-400">
                    <span>Réduction</span>
                    <span>-{formatFCFA(sale.discount_amount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-stone-800">
                  <span>TOTAL</span>
                  <span>{formatFCFA(sale.total)}</span>
                </div>
              </div>
              <p className="text-center text-xs text-stone-400 mt-3">
                Merci pour votre achat et à très bientôt !
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handlePrint}
                className="flex items-center justify-center gap-2 border border-stone-300 hover:bg-stone-50 text-stone-600 py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                <Printer size={14} />
                Imprimer
              </button>
              <button
                onClick={handleWhatsApp}
                className="flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                <Send size={14} />
                WhatsApp
              </button>
            </div>
            <button
              onClick={() => setShowReceiptModal(false)}
              className="w-full mt-2 text-stone-400 hover:text-stone-600 text-sm py-2"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  )
}