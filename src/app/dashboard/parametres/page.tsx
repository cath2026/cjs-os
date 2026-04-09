'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Save, Plus, Trash2 } from 'lucide-react'

type PaymentMethod = { id: string; name: string; is_active: boolean }
type DiscountRule = { id: string; name: string; type: string; value: number; is_active: boolean }
type ReceiptSettings = {
  id: string
  company_name: string
  address: string
  phone: string
  tax_number?: string
  footer_message: string
}
type BarcodeSettings = {
  id: string
  is_active: boolean
  prefix: string
  total_length: number
}

const SHOP_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

export default function ParametresPage() {
  const supabase = createClient()
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [discountRules, setDiscountRules] = useState<DiscountRule[]>([])
  const [receiptSettings, setReceiptSettings] = useState<ReceiptSettings | null>(null)
  const [barcodeSettings, setBarcodeSettings] = useState<BarcodeSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [newPayment, setNewPayment] = useState('')
  const [newDiscount, setNewDiscount] = useState({ name: '', type: 'fixed', value: 0 })
  const [receiptForm, setReceiptForm] = useState({
    company_name: '',
    address: '',
    phone: '',
    tax_number: '',
    footer_message: '',
  })
  const [barcodeForm, setBarcodeForm] = useState({
    is_active: true,
    prefix: 'CJS',
    total_length: 13,
  })

  const fetchData = async () => {
    const { data: pm } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('shop_id', SHOP_ID)
      .order('name')
    setPaymentMethods(pm || [])

    const { data: dr } = await supabase
      .from('discount_rules')
      .select('*')
      .eq('shop_id', SHOP_ID)
      .order('value')
    setDiscountRules(dr || [])

    const { data: rs } = await supabase
      .from('receipt_settings')
      .select('*')
      .eq('shop_id', SHOP_ID)
      .single()
    if (rs) {
      setReceiptSettings(rs)
      setReceiptForm({
        company_name: rs.company_name || '',
        address: rs.address || '',
        phone: rs.phone || '',
        tax_number: rs.tax_number || '',
        footer_message: rs.footer_message || '',
      })
    }

    const { data: bs } = await supabase
      .from('barcode_settings')
      .select('*')
      .eq('shop_id', SHOP_ID)
      .single()
    if (bs) {
      setBarcodeSettings(bs)
      setBarcodeForm({
        is_active: bs.is_active,
        prefix: bs.prefix,
        total_length: bs.total_length,
      })
    }

    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const handleAddPayment = async () => {
    if (!newPayment.trim()) return
    await supabase.from('payment_methods').insert({
      shop_id: SHOP_ID,
      name: newPayment.trim(),
      is_active: true,
    })
    setNewPayment('')
    fetchData()
  }

  const handleTogglePayment = async (id: string, is_active: boolean) => {
    await supabase.from('payment_methods').update({ is_active: !is_active }).eq('id', id)
    fetchData()
  }

  const handleDeletePayment = async (id: string) => {
    if (!confirm('Supprimer ce mode de paiement ?')) return
    await supabase.from('payment_methods').delete().eq('id', id)
    fetchData()
  }

  const handleAddDiscount = async () => {
    if (!newDiscount.name.trim() || newDiscount.value <= 0) return
    await supabase.from('discount_rules').insert({
      shop_id: SHOP_ID,
      name: newDiscount.name,
      type: newDiscount.type,
      value: newDiscount.value,
      is_active: true,
    })
    setNewDiscount({ name: '', type: 'fixed', value: 0 })
    fetchData()
  }

  const handleToggleDiscount = async (id: string, is_active: boolean) => {
    await supabase.from('discount_rules').update({ is_active: !is_active }).eq('id', id)
    fetchData()
  }

  const handleDeleteDiscount = async (id: string) => {
    if (!confirm('Supprimer cette réduction ?')) return
    await supabase.from('discount_rules').delete().eq('id', id)
    fetchData()
  }

  const handleSaveReceipt = async () => {
    setSaving(true)
    await supabase
      .from('receipt_settings')
      .update({ ...receiptForm, updated_at: new Date().toISOString() })
      .eq('id', receiptSettings?.id)
    setSaving(false)
    fetchData()
  }

  const handleSaveBarcode = async () => {
    setSaving(true)
    await supabase
      .from('barcode_settings')
      .update({ ...barcodeForm, updated_at: new Date().toISOString() })
      .eq('id', barcodeSettings?.id)
    setSaving(false)
    fetchData()
  }

  if (loading) return <div className="p-6 text-stone-400">Chargement...</div>

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-stone-800">Paramètres Généraux</h1>
        <p className="text-stone-500 text-sm">Configuration du système</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Modes de paiement */}
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <h2 className="font-semibold text-stone-700 mb-4">Modes de Paiement</h2>
          <div className="space-y-2 mb-3">
            {paymentMethods.map((pm) => (
              <div key={pm.id} className="flex items-center justify-between bg-stone-50 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={pm.is_active}
                    onChange={() => handleTogglePayment(pm.id, pm.is_active)}
                    className="accent-yellow-600"
                  />
                  <span className="text-sm text-stone-700">{pm.name}</span>
                </div>
                <button
                  onClick={() => handleDeletePayment(pm.id)}
                  className="text-red-400 hover:text-red-500"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={newPayment}
              onChange={(e) => setNewPayment(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddPayment()}
              placeholder="Nouveau mode..."
              className="flex-1 border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
            />
            <button
              onClick={handleAddPayment}
              className="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-2 rounded-lg transition-colors"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        {/* Règles de réduction */}
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <h2 className="font-semibold text-stone-700 mb-4">Règles de Réduction</h2>
          <div className="space-y-2 mb-3">
            {discountRules.map((dr) => (
              <div key={dr.id} className="flex items-center justify-between bg-stone-50 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={dr.is_active}
                    onChange={() => handleToggleDiscount(dr.id, dr.is_active)}
                    className="accent-yellow-600"
                  />
                  <span className="text-sm text-stone-700">
                    {dr.name} — {dr.type === 'fixed' ? `${dr.value} FCFA` : `${dr.value}%`}
                  </span>
                </div>
                <button
                  onClick={() => handleDeleteDiscount(dr.id)}
                  className="text-red-400 hover:text-red-500"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <input
              value={newDiscount.name}
              onChange={(e) => setNewDiscount({ ...newDiscount, name: e.target.value })}
              placeholder="Nom..."
              className="border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
            />
            <select
              value={newDiscount.type}
              onChange={(e) => setNewDiscount({ ...newDiscount, type: e.target.value })}
              className="border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
            >
              <option value="fixed">FCFA</option>
              <option value="percent">%</option>
            </select>
            <div className="flex gap-1">
              <input
                type="number"
                value={newDiscount.value}
                onChange={(e) => setNewDiscount({ ...newDiscount, value: Number(e.target.value) })}
                placeholder="Valeur"
                className="flex-1 border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
              <button
                onClick={handleAddDiscount}
                className="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-2 rounded-lg transition-colors"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Paramètres reçus */}
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <h2 className="font-semibold text-stone-700 mb-4">Paramètres des Reçus</h2>
          <div className="space-y-3">
            {[
              { key: 'company_name', label: 'Nom de l\'entreprise' },
              { key: 'address', label: 'Adresse' },
              { key: 'phone', label: 'Téléphone' },
              { key: 'tax_number', label: 'Numéro fiscal' },
            ].map((field) => (
              <div key={field.key}>
                <label className="block text-sm font-medium text-stone-700 mb-1">{field.label}</label>
                <input
                  value={receiptForm[field.key as keyof typeof receiptForm]}
                  onChange={(e) => setReceiptForm({ ...receiptForm, [field.key]: e.target.value })}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </div>
            ))}
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Message de pied de page</label>
              <textarea
                value={receiptForm.footer_message}
                onChange={(e) => setReceiptForm({ ...receiptForm, footer_message: e.target.value })}
                rows={2}
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
            </div>
            <button
              onClick={handleSaveReceipt}
              disabled={saving}
              className="flex items-center gap-2 bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              <Save size={14} />
              Enregistrer
            </button>
          </div>
        </div>

        {/* Paramètres codes-barres */}
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <h2 className="font-semibold text-stone-700 mb-4">Paramètres des Codes-Barres</h2>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={barcodeForm.is_active}
                onChange={(e) => setBarcodeForm({ ...barcodeForm, is_active: e.target.checked })}
                className="accent-yellow-600"
              />
              <label className="text-sm text-stone-700">Activer les codes-barres</label>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Préfixe</label>
              <input
                value={barcodeForm.prefix}
                onChange={(e) => setBarcodeForm({ ...barcodeForm, prefix: e.target.value.toUpperCase() })}
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Longueur totale</label>
              <input
                type="number"
                value={barcodeForm.total_length}
                onChange={(e) => setBarcodeForm({ ...barcodeForm, total_length: Number(e.target.value) })}
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
            </div>
            <button
              onClick={handleSaveBarcode}
              disabled={saving}
              className="flex items-center gap-2 bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              <Save size={14} />
              Enregistrer
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}