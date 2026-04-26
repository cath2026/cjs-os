'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Plus, Pencil, Trash2, Tag, RefreshCw } from 'lucide-react'

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
    setLoading(true)
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
    if (!form.name || !form.prefix) { setError('Nom et prefixe obligatoires'); return }
    if (form.prefix.length > 4) { setError('Prefixe maximum 4 caracteres'); return }
    setSaving(true)
    setError('')

    if (editing) {
      await supabase.from('categories').update({
        name: form.name,
        prefix: form.prefix.toUpperCase(),
        description: form.description,
        updated_at: new Date().toISOString()
      }).eq('id', editing.id)
    } else {
      await supabase.from('categories').insert({
        shop_id: SHOP_ID,
        name: form.name,
        prefix: form.prefix.toUpperCase(),
        description: form.description,
        next_ref_number: 1,
        is_active: true,
      })
    }

    setSaving(false)
    setShowModal(false)
    fetchCategories()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette categorie ?')) return
    await supabase.from('categories').update({ is_active: false }).eq('id', id)
    fetchCategories()
  }

  return (
    <div className="p-4 lg:p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-semibold text-stone-800">Categories de Produits</h1>
          <p className="text-stone-500 text-xs">{categories.length} categories</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchCategories} className="p-2 border border-stone-200 text-stone-400 rounded-lg hover:bg-stone-50">
            <RefreshCw size={14} />
          </button>
          <button onClick={openCreate}
            className="flex items-center gap-1.5 bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-2 rounded-lg text-xs font-medium">
            <Plus size={14} /> Nouvelle categorie
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-stone-400 text-sm">Chargement...</p>
      ) : categories.length === 0 ? (
        <div className="bg-white rounded-xl p-10 text-center shadow-sm">
          <p className="text-stone-400 text-sm">Aucune categorie. Creez-en une.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {categories.map((cat) => (
            <div key={cat.id} className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <Tag size={14} className="text-yellow-600 flex-shrink-0" />
                <h3 className="font-semibold text-stone-800 text-sm truncate">{cat.name}</h3>
              </div>
              <p className="text-xs text-stone-400 mb-1">
                Prefixe : <span className="font-mono font-medium text-stone-600">{cat.prefix}</span>
              </p>
              <p className="text-xs text-stone-400 mb-3">
                Prochaine ref : <span className="font-mono text-stone-600">{cat.prefix}-{String(cat.next_ref_number).padStart(4, '0')}</span>
              </p>
              {cat.description && (
                <p className="text-xs text-stone-400 mb-3 italic truncate">{cat.description}</p>
              )}
              <div className="flex gap-2">
                <button onClick={() => openEdit(cat)}
                  className="flex-1 flex items-center justify-center gap-1 border border-stone-300 hover:bg-stone-50 text-stone-600 py-1.5 rounded-lg text-xs transition-colors">
                  <Pencil size={11} /> Modifier
                </button>
                <button onClick={() => handleDelete(cat.id)}
                  className="p-1.5 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg transition-colors">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl p-5 w-full sm:max-w-md shadow-xl max-h-[92vh] overflow-y-auto">
            <h2 className="text-base font-semibold text-stone-800 mb-4">
              {editing ? 'Modifier la categorie' : 'Nouvelle categorie'}
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">Nom</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: Bracelets, Colliers..."
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">Prefixe (4 lettres max)</label>
                <input value={form.prefix} onChange={e => setForm({ ...form, prefix: e.target.value.toUpperCase() })}
                  placeholder="Ex: BRC, COL, BAG" maxLength={4}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">Description</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Description..." rows={2}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
              </div>
              {error && <p className="text-red-500 text-xs">{error}</p>}
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={handleSave} disabled={saving}
                className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
                {saving ? 'Enregistrement...' : editing ? 'Modifier' : 'Creer'}
              </button>
              <button onClick={() => setShowModal(false)}
                className="px-4 py-2 text-stone-600 hover:bg-stone-100 rounded-lg text-sm">
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}