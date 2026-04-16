'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Phone, Mail, MapPin, ShoppingBag, DollarSign, Pencil, X, Save } from 'lucide-react'

type Customer = {
  id: string
  full_name: string
  email?: string
  phone?: string
  address?: string
  notes?: string
  total_spent: number
  total_orders: number
  created_at: string
}

type Sale = {
  id: string
  status: string
  total: number
  created_at: string
  sale_items: {
    id: string
    product_name: string
    variant_name?: string
    quantity: number
    unit_price: number
    total_price: number
  }[]
}

const SHOP_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

export default function CustomerDetailPage() {
  const supabase = createClient()
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [customer, setCustomer] = useState<Customer | null>(null)
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    address: '',
    notes: '',
  })

  const fetchData = async () => {
    const { data: cust } = await supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .single()
    setCustomer(cust)

    if (cust) {
      setForm({
        full_name: cust.full_name || '',
        email: cust.email || '',
        phone: cust.phone || '',
        address: cust.address || '',
        notes: cust.notes || '',
      })
    }

    const { data: salesData } = await supabase
      .from('sales')
      .select('*, sale_items(*)')
      .eq('customer_id', id)
      .order('created_at', { ascending: false })
    setSales(salesData || [])

    setLoading(false)
  }

  useEffect(() => { fetchData() }, [id])

  const handleSave = async () => {
    setSaving(true)
    await supabase
      .from('customers')
      .update({
        full_name: form.full_name,
        email: form.email || null,
        phone: form.phone || null,
        address: form.address || null,
        notes: form.notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
    setSaving(false)
    setEditing(false)
    fetchData()
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

  if (loading) return <div className="p-6 text-stone-400">Chargement...</div>
  if (!customer) return <div className="p-6 text-stone-400">Client introuvable</div>

  const totalItems = sales
    .filter(s => s.status === 'paid')
    .reduce((sum, s) => sum + s.sale_items.reduce((a, i) => a + i.quantity, 0), 0)

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-stone-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={18} className="text-stone-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-stone-800">{customer.full_name}</h1>
          <p className="text-stone-500 text-sm">Détails du client</p>
        </div>
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-2 border border-stone-300 hover:bg-stone-50 text-stone-600 px-4 py-2 rounded-lg text-sm transition-colors"
          >
            <Pencil size={14} />
            Modifier
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              <Save size={14} />
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="flex items-center gap-2 border border-stone-300 hover:bg-stone-50 text-stone-600 px-4 py-2 rounded-lg text-sm transition-colors"
            >
              <X size={14} />
              Annuler
            </button>
          </div>
        )}
      </div>

<div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">        <div className="col-span-1 bg-white rounded-xl p-5 shadow-sm">
          <h2 className="font-semibold text-stone-700 mb-4">Informations</h2>
          {editing ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-stone-500 mb-1">Nom complet</label>
                <input
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </div>
              <div>
                <label className="block text-xs text-stone-500 mb-1">Email</label>
                <input
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </div>
              <div>
                <label className="block text-xs text-stone-500 mb-1">Téléphone</label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </div>
              <div>
                <label className="block text-xs text-stone-500 mb-1">Adresse</label>
                <input
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </div>
              <div>
                <label className="block text-xs text-stone-500 mb-1">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {customer.email && (
                <div className="flex items-center gap-2 text-sm text-stone-600">
                  <Mail size={14} className="text-stone-400" />
                  {customer.email}
                </div>
              )}
              {customer.phone && (
                <div className="flex items-center gap-2 text-sm text-stone-600">
                  <Phone size={14} className="text-stone-400" />
                  {customer.phone}
                </div>
              )}
              {customer.address && (
                <div className="flex items-center gap-2 text-sm text-stone-600">
                  <MapPin size={14} className="text-stone-400" />
                  {customer.address}
                </div>
              )}
              {customer.notes && (
                <div className="text-sm text-stone-500 italic">{customer.notes}</div>
              )}
              <p className="text-xs text-stone-400">
                Créé le {new Date(customer.created_at).toLocaleDateString('fr-FR')}
              </p>
            </div>
          )}
        </div>

<div className="col-span-1 lg:col-span-2 grid grid-cols-2 lg:grid-cols-4 gap-3">          <div className="bg-white rounded-xl p-4 shadow-sm flex flex-col items-center justify-center">
            <DollarSign size={20} className="text-yellow-500 mb-1" />
            <p className="text-xs text-stone-400 mb-1">Total dépensé</p>
            <p className="font-bold text-stone-800 text-center text-sm">{formatFCFA(customer.total_spent)}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm flex flex-col items-center justify-center">
            <ShoppingBag size={20} className="text-stone-400 mb-1" />
            <p className="text-xs text-stone-400 mb-1">Commandes</p>
            <p className="text-2xl font-bold text-stone-800">{customer.total_orders}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm flex flex-col items-center justify-center">
            <ShoppingBag size={20} className="text-green-400 mb-1" />
            <p className="text-xs text-stone-400 mb-1">Payées</p>
            <p className="text-2xl font-bold text-stone-800">
              {sales.filter(s => s.status === 'paid').length}
            </p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm flex flex-col items-center justify-center">
            <ShoppingBag size={20} className="text-blue-400 mb-1" />
            <p className="text-xs text-stone-400 mb-1">Articles achetés</p>
            <p className="text-2xl font-bold text-stone-800">{totalItems}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-5 shadow-sm">
        <h2 className="font-semibold text-stone-700 mb-4">
          Historique des achats ({sales.length})
        </h2>
        {sales.length === 0 ? (
          <p className="text-stone-400 text-sm">Aucun achat enregistré</p>
        ) : (
          <div className="space-y-3">
            {sales.map((sale) => (
              <div key={sale.id} className="border border-stone-100 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[sale.status]}`}>
                      {statusLabel[sale.status]}
                    </span>
                    <span className="text-xs text-stone-400">
                      {new Date(sale.created_at).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                  <p className="font-bold text-stone-800">{formatFCFA(sale.total)}</p>
                </div>
                <div className="space-y-1">
                  {sale.sale_items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between text-xs bg-stone-50 rounded-lg px-3 py-1.5">
                      <span className="text-stone-600">
                        {item.product_name} {item.variant_name && `— ${item.variant_name}`}
                      </span>
                      <div className="flex gap-4">
                        <span className="text-stone-400">x{item.quantity}</span>
                        <span className="font-medium text-stone-700">{formatFCFA(item.total_price)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}