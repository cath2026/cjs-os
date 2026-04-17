'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Phone, Mail, MapPin, ShoppingBag, DollarSign, Pencil, X, Save, Globe } from 'lucide-react'

type Customer = {
  id: string
  full_name: string
  email?: string
  phone?: string
  address?: string
  notes?: string
  created_at: string
}

type Transaction = {
  id: string
  type: 'boutique' | 'site'
  status: string
  total: number
  created_at: string
  ref?: string
  items: {
    name: string
    variant?: string
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
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', address: '', notes: '' })

  const fetchData = async () => {
    // Client
    const { data: cust } = await supabase.from('customers').select('*').eq('id', id).single()
    setCustomer(cust)
    if (cust) setForm({ full_name: cust.full_name || '', email: cust.email || '', phone: cust.phone || '', address: cust.address || '', notes: cust.notes || '' })

    // Ventes boutique
    const { data: sales } = await supabase
      .from('sales')
      .select('*, sale_items(*)')
      .eq('customer_id', id)
      .order('created_at', { ascending: false })

    const boutiqueTx: Transaction[] = (sales || []).map(s => ({
      id: s.id,
      type: 'boutique',
      status: s.status,
      total: s.total,
      created_at: s.created_at,
      items: (s.sale_items || []).map((i: any) => ({
        name: i.product_name,
        variant: i.variant_name,
        quantity: i.quantity,
        unit_price: i.unit_price,
        total_price: i.total_price,
      }))
    }))

    // Commandes site (par téléphone)
    let siteTx: Transaction[] = []
    if (cust?.phone) {
      const cleanPhone = cust.phone.replace(/\D/g, '')
      const { data: orders } = await supabase
        .from('orders')
        .select('*')
        .eq('shop_id', SHOP_ID)
        .order('created_at', { ascending: false })

      siteTx = (orders || [])
        .filter(o => o.customer_phone && o.customer_phone.replace(/\D/g, '') === cleanPhone)
        .map(o => ({
          id: o.id,
          type: 'site',
          status: o.status,
          total: o.total,
          created_at: o.created_at,
          ref: o.order_ref,
          items: (o.items || []).map((i: any) => ({
            name: i.name,
            variant: i.variant,
            quantity: i.quantity,
            unit_price: i.price,
            total_price: i.price * i.quantity,
          }))
        }))
    }

    // Fusionner et trier par date
    const all = [...boutiqueTx, ...siteTx].sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    setTransactions(all)
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [id])

  const handleSave = async () => {
    setSaving(true)
    await supabase.from('customers').update({
      full_name: form.full_name, email: form.email || null, phone: form.phone || null,
      address: form.address || null, notes: form.notes || null, updated_at: new Date().toISOString(),
    }).eq('id', id)
    setSaving(false)
    setEditing(false)
    fetchData()
  }

  const formatFCFA = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA'
  const formatDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })

  // KPIs calculés depuis les transactions réelles
  const paidTx = transactions.filter(t => t.status === 'paid' || t.status === 'livré')
  const totalSpent = paidTx.reduce((s, t) => s + t.total, 0)
  const totalOrders = transactions.length
  const paidOrders = paidTx.length
  const totalItems = paidTx.reduce((s, t) => s + t.items.reduce((si, i) => si + i.quantity, 0), 0)

  const statusLabel: Record<string, string> = {
    draft: 'Brouillon', in_delivery: 'En livraison', paid: 'Payée', cancelled: 'Annulée',
    commandé: 'Commandé', 'en preparation': 'En préparation', 'en livraison': 'En livraison',
    livré: 'Livré', annulé: 'Annulé',
  }
  const statusColor: Record<string, string> = {
    draft: 'bg-stone-100 text-stone-600', in_delivery: 'bg-blue-100 text-blue-600',
    paid: 'bg-green-100 text-green-600', cancelled: 'bg-red-100 text-red-500',
    commandé: 'bg-yellow-100 text-yellow-700', 'en preparation': 'bg-blue-100 text-blue-600',
    'en livraison': 'bg-orange-100 text-orange-600', livré: 'bg-green-100 text-green-600',
    annulé: 'bg-red-100 text-red-500',
  }

  if (loading) return <div className="p-6 text-stone-400">Chargement...</div>
  if (!customer) return <div className="p-6 text-stone-400">Client introuvable</div>

  return (
    <div className="p-4 lg:p-6">
      {/* HEADER */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <button onClick={() => router.back()} className="p-2 hover:bg-stone-100 rounded-lg">
          <ArrowLeft size={18} className="text-stone-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-stone-800">{customer.full_name}</h1>
          <p className="text-stone-500 text-xs">Client depuis le {formatDate(customer.created_at)}</p>
        </div>
        {!editing ? (
          <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 border border-stone-300 hover:bg-stone-50 text-stone-600 px-3 py-2 rounded-lg text-xs">
            <Pencil size={13} /> Modifier
          </button>
        ) : (
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-2 rounded-lg text-xs font-medium disabled:opacity-50">
              <Save size={13} /> {saving ? '...' : 'Enregistrer'}
            </button>
            <button onClick={() => setEditing(false)} className="flex items-center gap-1.5 border border-stone-300 text-stone-600 px-3 py-2 rounded-lg text-xs">
              <X size={13} /> Annuler
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* INFOS CLIENT */}
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <h2 className="font-semibold text-stone-700 mb-3 text-sm">Informations</h2>
          {editing ? (
            <div className="space-y-2">
              {[
                { key: 'full_name', label: 'Nom complet' },
                { key: 'email', label: 'Email' },
                { key: 'phone', label: 'Téléphone' },
                { key: 'address', label: 'Adresse' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs text-stone-400 mb-0.5">{f.label}</label>
                  <input value={form[f.key as keyof typeof form]} onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                    className="w-full border border-stone-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
                </div>
              ))}
              <div>
                <label className="block text-xs text-stone-400 mb-0.5">Notes</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2}
                  className="w-full border border-stone-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {customer.phone && (
                <div className="flex items-center gap-2 text-sm text-stone-600">
                  <Phone size={13} className="text-stone-400 flex-shrink-0" />
                  <a href={`https://wa.me/${customer.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="text-green-600 hover:underline">
                    {customer.phone}
                  </a>
                </div>
              )}
              {customer.email && (
                <div className="flex items-center gap-2 text-sm text-stone-600">
                  <Mail size={13} className="text-stone-400 flex-shrink-0" /> {customer.email}
                </div>
              )}
              {customer.address && (
                <div className="flex items-center gap-2 text-sm text-stone-600">
                  <MapPin size={13} className="text-stone-400 flex-shrink-0" /> {customer.address}
                </div>
              )}
              {customer.notes && <p className="text-xs text-stone-400 italic mt-2">{customer.notes}</p>}
            </div>
          )}
        </div>

        {/* KPIs */}
        <div className="col-span-1 lg:col-span-2 grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { icon: DollarSign, color: 'text-yellow-500', label: 'Total dépensé', value: formatFCFA(totalSpent) },
            { icon: ShoppingBag, color: 'text-stone-400', label: 'Commandes', value: totalOrders },
            { icon: ShoppingBag, color: 'text-green-400', label: 'Payées/Livrées', value: paidOrders },
            { icon: ShoppingBag, color: 'text-blue-400', label: 'Articles achetés', value: totalItems },
          ].map((kpi, i) => (
            <div key={i} className="bg-white rounded-xl p-4 shadow-sm flex flex-col items-center justify-center text-center">
              <kpi.icon size={18} className={`${kpi.color} mb-1`} />
              <p className="text-xs text-stone-400 mb-1">{kpi.label}</p>
              <p className="font-bold text-stone-800 text-sm">{kpi.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* HISTORIQUE */}
      <div className="bg-white rounded-xl p-5 shadow-sm">
        <h2 className="font-semibold text-stone-700 mb-1 text-sm">
          Historique complet ({transactions.length})
        </h2>
        <p className="text-xs text-stone-400 mb-4">
          Boutique + Site · Total payé: <strong className="text-stone-600">{formatFCFA(totalSpent)}</strong>
        </p>

        {transactions.length === 0 ? (
          <p className="text-stone-400 text-sm text-center py-6">Aucun achat enregistré</p>
        ) : (
          <div className="space-y-3">
            {transactions.map(tx => (
              <div key={tx.id} className="border border-stone-100 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {tx.type === 'site' ? (
                      <span className="flex items-center gap-1 text-xs bg-blue-50 text-blue-600 border border-blue-200 px-2 py-0.5 rounded-full font-medium">
                        <Globe size={10} /> Site {tx.ref && `#${tx.ref}`}
                      </span>
                    ) : (
                      <span className="text-xs bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full font-medium">
                        Boutique
                      </span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[tx.status] || 'bg-stone-100 text-stone-600'}`}>
                      {statusLabel[tx.status] || tx.status}
                    </span>
                    <span className="text-xs text-stone-400">{formatDate(tx.created_at)}</span>
                  </div>
                  <p className="font-bold text-stone-800 text-sm">{formatFCFA(tx.total)}</p>
                </div>
                <div className="space-y-1">
                  {tx.items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-xs bg-stone-50 rounded-lg px-3 py-1.5">
                      <span className="text-stone-600 truncate">{item.name}{item.variant && ` — ${item.variant}`}</span>
                      <div className="flex gap-3 flex-shrink-0 ml-2">
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