'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Plus, Users, Phone, Mail, ShoppingBag } from 'lucide-react'
import { useRouter } from 'next/navigation'

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

const SHOP_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

export default function ClientsPage() {
  const supabase = createClient()
  const router = useRouter()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    address: '',
    notes: '',
  })

  const fetchCustomers = async () => {
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('shop_id', SHOP_ID)
      .order('total_spent', { ascending: false })
    setCustomers(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchCustomers() }, [])

  const handleSave = async () => {
    if (!form.full_name) {
      setError('Le nom est obligatoire')
      return
    }
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

  const filtered = customers.filter(c =>
    c.full_name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-stone-800">Clients</h1>
          <p className="text-stone-500 text-sm">{customers.length} clients enregistrés</p>
        </div>
        <button
          onClick={() => {
            setForm({ full_name: '', email: '', phone: '', address: '', notes: '' })
            setError('')
            setShowModal(true)
          }}
          className="flex items-center gap-2 bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Nouveau client
        </button>
      </div>

      <div className="mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher par nom, email ou téléphone..."
          className="w-full border border-stone-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
        />
      </div>

      {loading ? (
        <p className="text-stone-400">Chargement...</p>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl p-12 shadow-sm flex flex-col items-center justify-center">
          <Users size={48} className="text-stone-300 mb-3" />
          <p className="text-stone-400 font-medium">Aucun client trouvé</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((customer, index) => (
            <div
              key={customer.id}
              onClick={() => router.push(`/dashboard/clients/${customer.id}`)}
              className="bg-white rounded-xl p-4 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                    index === 0 ? 'bg-yellow-500' :
                    index === 1 ? 'bg-stone-400' :
                    index === 2 ? 'bg-amber-600' : 'bg-stone-300'
                  }`}>
                    {index + 1}
                  </div>
                  <div>
                    <h3 className="font-semibold text-stone-800">{customer.full_name}</h3>
                    <div className="flex gap-3 mt-0.5">
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
                    <p className="text-xs text-stone-400 mt-0.5">
                      Créé le {new Date(customer.created_at).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                </div>

                <div className="flex gap-6 text-right">
                  <div>
                    <p className="text-xs text-stone-400">Valeur achats</p>
                    <p className="font-bold text-stone-800">{formatFCFA(customer.total_spent)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-stone-400">Commandes</p>
                    <p className="font-bold text-stone-800">{customer.total_orders}</p>
                  </div>
                  <div>
                    <p className="text-xs text-stone-400">Articles</p>
                    <p className="font-bold text-stone-800">
                      <ShoppingBag size={14} className="inline mr-1" />
                      {customer.total_orders}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-semibold text-stone-800 mb-4">Nouveau client</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Nom complet</label>
                <input
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Téléphone</label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Adresse</label>
                <input
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </div>
            </div>
            {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
            <div className="flex gap-3 mt-5">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {saving ? 'Création...' : 'Créer'}
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-stone-600 hover:bg-stone-100 rounded-lg text-sm"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}