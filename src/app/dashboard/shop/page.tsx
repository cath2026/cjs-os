'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Store, Pencil, Save, X } from 'lucide-react'

type Shop = {
  id: string
  name: string
  address?: string
  city: string
  country: string
  currency: string
  phone?: string
  email?: string
  description?: string
  is_active: boolean
}

const SHOP_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

export default function ShopPage() {
  const supabase = createClient()
  const [shop, setShop] = useState<Shop | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    address: '',
    city: '',
    country: '',
    currency: '',
    phone: '',
    email: '',
    description: '',
  })

  const fetchShop = async () => {
    const { data } = await supabase
      .from('shops')
      .select('*')
      .eq('id', SHOP_ID)
      .single()
    if (data) {
      setShop(data)
      setForm({
        name: data.name || '',
        address: data.address || '',
        city: data.city || '',
        country: data.country || '',
        currency: data.currency || '',
        phone: data.phone || '',
        email: data.email || '',
        description: data.description || '',
      })
    }
    setLoading(false)
  }

  useEffect(() => { fetchShop() }, [])

  const handleSave = async () => {
    setSaving(true)
    await supabase
      .from('shops')
      .update({ ...form, updated_at: new Date().toISOString() })
      .eq('id', SHOP_ID)

    await supabase.from('logs').insert({
      shop_id: SHOP_ID,
      action: 'Mise à jour shop',
      module: 'shop',
    })

    setSaving(false)
    setEditing(false)
    fetchShop()
  }

  if (loading) return <div className="p-6 text-stone-400">Chargement...</div>

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-stone-800">Informations du Shop</h1>
          <p className="text-stone-500 text-sm">Gérez les informations de votre boutique</p>
        </div>
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-2 border border-stone-300 hover:bg-stone-50 text-stone-600 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
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

      <div className="bg-white rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-black rounded-xl flex items-center justify-center">
            <Store size={20} className="text-yellow-400" />
          </div>
          <div>
            <h2 className="font-bold text-stone-800 text-lg">{shop?.name}</h2>
            <p className="text-sm text-stone-400">
              {shop?.city}, {shop?.country} | Monnaie: {shop?.currency}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {[
            { key: 'name', label: 'Nom de la boutique' },
            { key: 'address', label: 'Adresse' },
            { key: 'city', label: 'Ville' },
            { key: 'country', label: 'Pays' },
            { key: 'currency', label: 'Monnaie' },
            { key: 'phone', label: 'Téléphone' },
            { key: 'email', label: 'Email' },
          ].map((field) => (
            <div key={field.key}>
              <label className="block text-sm font-medium text-stone-500 mb-1">{field.label}</label>
              {editing ? (
                <input
                  value={form[field.key as keyof typeof form]}
                  onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              ) : (
                <p className="text-stone-800 text-sm">
                  {shop?.[field.key as keyof Shop] as string || '—'}
                </p>
              )}
            </div>
          ))}

          <div className="col-span-2">
            <label className="block text-sm font-medium text-stone-500 mb-1">Description</label>
            {editing ? (
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
            ) : (
              <p className="text-stone-800 text-sm">{shop?.description || '—'}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}