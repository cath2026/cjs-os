'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Plus, Users, Phone, Mail, Search, SlidersHorizontal, X } from 'lucide-react'
import { useRouter } from 'next/navigation'

type Customer = {
  id: string
  full_name: string
  email?: string
  phone?: string
  address?: string
  notes?: string
  created_at: string
  // Calculés depuis les ventes réelles
  total_spent: number
  total_orders: number
  last_order_date?: string
}

const SHOP_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

export default function ClientsPage() {
  const supabase = createClient()
  const router = useRouter()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({
    minAmount: '',
    maxAmount: '',
    lastOrderDays: '',
    sortBy: 'total_spent',
  })
  const [form, setForm] = useState({
    full_name: '', email: '', phone: '', address: '', notes: '',
  })

  const fetchCustomers = async () => {
    setLoading(true)

    // Récupérer tous les clients
    const { data: rawCustomers } = await supabase
      .from('customers')
      .select('*')
      .eq('shop_id', SHOP_ID)

    if (!rawCustomers) { setLoading(false); return }

    // Récupérer toutes les ventes boutique payées
    const { data: sales } = await supabase
      .from('sales')
      .select('id, total, customer_id, created_at')
      .eq('shop_id', SHOP_ID)
      .eq('status', 'paid')

    // Récupérer toutes les commandes site livrées
    const { data: orders } = await supabase
      .from('orders')
      .select('id, total, customer_name, customer_phone, created_at')
      .eq('shop_id', SHOP_ID)
      .eq('status', 'livré')

    // Calculer total_spent et total_orders pour chaque client
    const enriched = rawCustomers.map(c => {
      // Ventes boutique liées à ce client
      const clientSales = sales?.filter(s => s.customer_id === c.id) || []

      // Commandes site liées par téléphone
      const clientOrders = orders?.filter(o =>
        c.phone && o.customer_phone &&
        o.customer_phone.replace(/\D/g, '') === c.phone.replace(/\D/g, '')
      ) || []

      const allTotals = [
        ...clientSales.map(s => ({ total: s.total, date: s.created_at })),
        ...clientOrders.map(o => ({ total: o.total, date: o.created_at })),
      ]

      const total_spent = allTotals.reduce((sum, t) => sum + (t.total || 0), 0)
      const total_orders = allTotals.length
      const last_order_date = allTotals.length > 0
        ? allTotals.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].date
        : undefined

      return { ...c, total_spent, total_orders, last_order_date }
    })

    setCustomers(enriched)
    setLoading(false)
  }

  useEffect(() => { fetchCustomers() }, [])

  const handleSave = async () => {
    if (!form.full_name) { setError('Le nom est obligatoire'); return }
    setSaving(true)
    setError('')
    await supabase.from('customers').insert({
      shop_id: SHOP_ID,
      full_name: form.full_name,
      email: form.email || null,
      phone: form.phone || null,
      address: form.address || null,
      notes: form.notes || null,
    })
    setSaving(false)
    setShowModal(false)
    setForm({ full_name: '', email: '', phone: '', address: '', notes: '' })
    fetchCustomers()
  }

  const formatFCFA = (amount: number) =>
    new Intl.NumberFormat('fr-FR').format(Math.round(amount)) + ' FCFA'

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })

  const daysSince = (d: string) =>
    Math.floor((Date.now() - new Date(d).getTime()) / (1000 * 60 * 60 * 24))

  // Filtrage
  const filtered = customers
    .filter(c => {
      const q = search.toLowerCase()
      if (search && !c.full_name.toLowerCase().includes(q) &&
        !c.phone?.includes(q) && !c.email?.toLowerCase().includes(q)) return false

      if (filters.minAmount && c.total_spent < Number(filters.minAmount)) return false
      if (filters.maxAmount && c.total_spent > Number(filters.maxAmount)) return false

      if (filters.lastOrderDays && c.last_order_date) {
        if (daysSince(c.last_order_date) > Number(filters.lastOrderDays)) return false
      }
      if (filters.lastOrderDays && !c.last_order_date) return false

      return true
    })
    .sort((a, b) => {
      if (filters.sortBy === 'total_spent') return b.total_spent - a.total_spent
      if (filters.sortBy === 'total_orders') return b.total_orders - a.total_orders
      if (filters.sortBy === 'last_order') {
        return new Date(b.last_order_date || 0).getTime() - new Date(a.last_order_date || 0).getTime()
      }
      if (filters.sortBy === 'name') return a.full_name.localeCompare(b.full_name)
      if (filters.sortBy === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      return 0
    })

  const hasFilters = filters.minAmount || filters.maxAmount || filters.lastOrderDays

  return (
    <div className="p-4 lg:p-6">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold text-stone-800">Clients</h1>
          <p className="text-stone-500 text-xs">{customers.length} clients · {filtered.length} affichés</p>
        </div>
        <button
          onClick={() => { setForm({ full_name: '', email: '', phone: '', address: '', notes: '' }); setError(''); setShowModal(true) }}
          className="flex items-center gap-1.5 bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-2 rounded-lg text-xs font-medium"
        >
          <Plus size={14} /> Nouveau
        </button>
      </div>

      {/* RECHERCHE + FILTRES */}
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Nom, téléphone, email..."
            className="w-full border border-stone-200 rounded-lg pl-8 pr-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-yellow-400"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs border transition-colors ${hasFilters ? 'bg-yellow-50 border-yellow-300 text-yellow-700' : 'border-stone-200 text-stone-500 hover:bg-stone-50'}`}
        >
          <SlidersHorizontal size={13} />
          Filtres {hasFilters && `(${[filters.minAmount, filters.maxAmount, filters.lastOrderDays].filter(Boolean).length})`}
        </button>
      </div>

      {/* PANNEAU FILTRES */}
      {showFilters && (
        <div className="bg-white border border-stone-100 rounded-xl p-4 mb-3 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-stone-600">Filtres avancés</p>
            {hasFilters && (
              <button onClick={() => setFilters({ minAmount: '', maxAmount: '', lastOrderDays: '', sortBy: 'total_spent' })}
                className="text-xs text-red-400 hover:text-red-500 flex items-center gap-1">
                <X size={11} /> Réinitialiser
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-stone-400 mb-1">Montant min (FCFA)</label>
              <input type="number" value={filters.minAmount} onChange={e => setFilters({ ...filters, minAmount: e.target.value })}
                placeholder="0" className="w-full border border-stone-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-yellow-400" />
            </div>
            <div>
              <label className="block text-xs text-stone-400 mb-1">Montant max (FCFA)</label>
              <input type="number" value={filters.maxAmount} onChange={e => setFilters({ ...filters, maxAmount: e.target.value })}
                placeholder="∞" className="w-full border border-stone-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-yellow-400" />
            </div>
            <div>
              <label className="block text-xs text-stone-400 mb-1">Dernière commande</label>
              <select value={filters.lastOrderDays} onChange={e => setFilters({ ...filters, lastOrderDays: e.target.value })}
                className="w-full border border-stone-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-yellow-400">
                <option value="">Toutes</option>
                <option value="7">7 derniers jours</option>
                <option value="30">30 derniers jours</option>
                <option value="90">90 derniers jours</option>
                <option value="180">6 derniers mois</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-stone-400 mb-1">Trier par</label>
              <select value={filters.sortBy} onChange={e => setFilters({ ...filters, sortBy: e.target.value })}
                className="w-full border border-stone-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-yellow-400">
                <option value="total_spent">Montant dépensé</option>
                <option value="total_orders">Nb commandes</option>
                <option value="last_order">Dernière commande</option>
                <option value="name">Nom A→Z</option>
                <option value="newest">Plus récent</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* LISTE */}
      {loading ? (
        <p className="text-stone-400 text-sm">Chargement...</p>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl p-10 shadow-sm flex flex-col items-center justify-center">
          <Users size={40} className="text-stone-300 mb-3" />
          <p className="text-stone-400 text-sm">Aucun client trouvé</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((customer, index) => (
            <div key={customer.id} onClick={() => router.push(`/dashboard/clients/${customer.id}`)}
              className="bg-white rounded-xl p-4 shadow-sm cursor-pointer hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0 ${
                    index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-stone-400' : index === 2 ? 'bg-amber-600' : 'bg-stone-300'
                  }`}>
                    {index + 1}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-stone-800 text-sm truncate">{customer.full_name}</h3>
                    <div className="flex gap-3 mt-0.5 flex-wrap">
                      {customer.phone && (
                        <span className="flex items-center gap-1 text-xs text-stone-400">
                          <Phone size={10} /> {customer.phone}
                        </span>
                      )}
                      {customer.email && (
                        <span className="flex items-center gap-1 text-xs text-stone-400">
                          <Mail size={10} /> {customer.email}
                        </span>
                      )}
                    </div>
                    {customer.last_order_date && (
                      <p className="text-xs text-stone-400 mt-0.5">
                        Dernière commande : {formatDate(customer.last_order_date)}
                        {daysSince(customer.last_order_date) <= 7 && (
                          <span className="ml-1 text-green-500 font-medium">· Récent</span>
                        )}
                        {daysSince(customer.last_order_date) > 90 && (
                          <span className="ml-1 text-orange-400 font-medium">· Inactif</span>
                        )}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-4 text-right flex-shrink-0">
                  <div>
                    <p className="text-xs text-stone-400">Dépensé</p>
                    <p className="font-bold text-stone-800 text-sm">{formatFCFA(customer.total_spent)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-stone-400">Commandes</p>
                    <p className="font-bold text-stone-800 text-sm">{customer.total_orders}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL NOUVEAU CLIENT */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl p-5 w-full sm:max-w-md shadow-xl max-h-[92vh] overflow-y-auto">
            <h2 className="text-base font-semibold text-stone-800 mb-4">Nouveau client</h2>
            <div className="space-y-3">
              {[
                { key: 'full_name', label: 'Nom complet *', type: 'text' },
                { key: 'email', label: 'Email', type: 'email' },
                { key: 'phone', label: 'Téléphone', type: 'text' },
                { key: 'address', label: 'Adresse', type: 'text' },
              ].map(field => (
                <div key={field.key}>
                  <label className="block text-xs font-medium text-stone-700 mb-1">{field.label}</label>
                  <input
                    type={field.type}
                    value={form[field.key as keyof typeof form]}
                    onChange={e => setForm({ ...form, [field.key]: e.target.value })}
                    className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
              </div>
            </div>
            {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
            <div className="flex gap-2 mt-4">
              <button onClick={handleSave} disabled={saving}
                className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
                {saving ? 'Création...' : 'Créer'}
              </button>
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-stone-600 hover:bg-stone-100 rounded-lg text-sm">
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}