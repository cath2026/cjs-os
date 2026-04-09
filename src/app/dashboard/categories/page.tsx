'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Plus, Pencil, Trash2, Tag } from 'lucide-react'

type Category = {
  id: string
  name: string
  prefix: string
  description?: string
  next_ref_number: number
  is_active: boolean
}

const SHOP_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

export default function CategoriesPage() {
  const supabase = createClient()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [form, setForm] = useState({ name: '', prefix: '', description: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const fetchCategories = async () => {
    const { data } = await supabase
      .from('categories')
      .select('*')
      .eq('shop_id', SHOP_ID)
      .eq('is_active', true)
      .order('name')
    setCategories(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchCategories() }, [])

  const openCreate = () => {
    setEditing(null)
    setForm({ name: '', prefix: '', description: '' })
    setError('')
    setShowModal(true)
  }

  const openEdit = (cat: Category) => {
    setEditing(cat)
    setForm({ name: cat.name, prefix: cat.prefix, description: cat.description || '' })
    setError('')
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.name || !form.prefix) {
      setError('Nom et préfixe obligatoires')
      return
    }
    if (form.prefix.length > 4) {
      setError('Préfixe maximum 4 caractères')
      return
    }
    setSaving(true)
    setError('')

    if (editing) {
      await supabase
        .from('categories')
        .update({ name: form.name, prefix: form.prefix.toUpperCase(), description: form.description, updated_at: new Date().toISOString() })
        .eq('id', editing.id)
    } else {
      await supabase
        .from('categories')
        .insert({ shop_id: SHOP_ID, name: form.name, prefix: form.prefix.toUpperCase(), description: form.description })
    }

    setSaving(false)
    setShowModal(false)
    fetchCategories()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette catégorie ?')) return
    await supabase.from('categories').update({ is_active: false }).eq('id', id)
    fetchCategories()
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-stone-800">Catégories de Produits</h1>
          <p className="text-stone-500 text-sm">{categories.length} catégories</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Nouvelle catégorie
        </button>
      </div>

      {loading ? (
        <p className="text-stone-400">Chargement...</p>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {categories.map((cat) => (
            <div key={cat.id} className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Tag size={16} className="text-yellow-600" />
                <h3 className="font-semibold text-stone-800">{cat.name}</h3>
              </div>
              <p className="text-xs text-stone-400 mb-1">Préfixe: {cat.prefix}</p>
              <p className="text-xs text-stone-400 mb-4">
                Prochaine référence: {cat.prefix}-{String(cat.next_ref_number).padStart(4, '0')}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => openEdit(cat)}
                  className="flex-1 flex items-center justify-center gap-1 border border-stone-300 hover:bg-stone-50 text-stone-600 py-1.5 rounded-lg text-xs transition-colors"
                >
                  <Pencil size={12} />
                  Modifier
                </button>
                <button
                  onClick={() => handleDelete(cat.id)}
                  className="p-1.5 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-semibold text-stone-800 mb-4">
              {editing ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
            </h2>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Nom de la catégorie
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: Bracelets, Colliers, Bagues..."
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Préfixe (4 lettres max)
                </label>
                <input
                  value={form.prefix}
                  onChange={(e) => setForm({ ...form, prefix: e.target.value.toUpperCase() })}
                  placeholder="Ex: BRC, COL, BAG"
                  maxLength={4}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Description de la catégorie..."
                  rows={3}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </div>

              {error && <p className="text-red-500 text-sm">{error}</p>}
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {saving ? 'Enregistrement...' : 'Créer'}
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-stone-600 hover:bg-stone-100 rounded-lg text-sm transition-colors"
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