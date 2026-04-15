'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { Plus, Trash2, Image, RefreshCw, Link } from 'lucide-react'

type CustomPart = {
  id: string
  type: 'chain' | 'charm'
  name: string
  name_en?: string
  price: number
  cost_price: number
  stock: number
  image_url?: string
  is_active: boolean
}

const SHOP_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

export default function ConstruisPage() {
  const supabase = createClient()
  const [parts, setParts] = useState<CustomPart[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'chain' | 'charm'>('chain')
  const [form, setForm] = useState({
    type: 'chain' as 'chain' | 'charm',
    name: '',
    name_en: '',
    price: 0,
    cost_price: 0,
    stock: 0,
  })
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchParts = async () => {
    const { data } = await supabase
      .from('custom_parts')
      .select('*')
      .eq('shop_id', SHOP_ID)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
    setParts(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchParts() }, [])

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const uploadImage = async (partId: string): Promise<string | null> => {
    if (!imageFile) return null
    const ext = imageFile.name.split('.').pop()
    const path = `custom/${partId}.${ext}`
    const { error } = await supabase.storage.from('products').upload(path, imageFile, { upsert: true })
    if (error) return null
    const { data } = supabase.storage.from('products').getPublicUrl(path)
    return data.publicUrl
  }

  const handleSave = async () => {
    if (!form.name) { setError('Nom obligatoire'); return }
    if (form.price <= 0) { setError('Prix de vente obligatoire'); return }
    setSaving(true)
    setError('')

    const { data: part, error: partError } = await supabase
      .from('custom_parts')
      .insert({
        shop_id: SHOP_ID,
        type: form.type,
        name: form.name,
        name_en: form.name_en,
        price: form.price,
        cost_price: form.cost_price,
        stock: form.stock,
        is_active: true,
      })
      .select()
      .single()

    if (partError || !part) { setError('Erreur lors de la création'); setSaving(false); return }

    if (imageFile) {
      const url = await uploadImage(part.id)
      if (url) await supabase.from('custom_parts').update({ image_url: url }).eq('id', part.id)
    }

    setSaving(false)
    setShowModal(false)
    setForm({ type: activeTab, name: '', name_en: '', price: 0, cost_price: 0, stock: 0 })
    setImageFile(null)
    setImagePreview(null)
    fetchParts()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette pièce ?')) return
    await supabase.from('custom_parts').update({ is_active: false }).eq('id', id)
    fetchParts()
  }

  const updateStock = async (id: string, newStock: number) => {
    if (newStock < 0) return
    await supabase.from('custom_parts').update({ stock: newStock, updated_at: new Date().toISOString() }).eq('id', id)
    fetchParts()
  }

  const chains = parts.filter(p => p.type === 'chain')
  const charms = parts.filter(p => p.type === 'charm')
  const displayed = activeTab === 'chain' ? chains : charms

  const formatFCFA = (amount: number) => new Intl.NumberFormat('fr-FR').format(Math.round(amount)) + ' FCFA'

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-stone-800">Construis ton bijou</h1>
          <p className="text-stone-500 text-sm">{chains.length} chaîne(s) · {charms.length} charm(s)</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchParts} className="flex items-center gap-2 border border-stone-300 text-stone-600 px-3 py-2 rounded-lg text-sm hover:bg-stone-50">
            <RefreshCw size={14} /> Actualiser
          </button>
          <button
            onClick={() => {
              setForm({ type: activeTab, name: '', name_en: '', price: 0, cost_price: 0, stock: 0 })
              setImageFile(null)
              setImagePreview(null)
              setError('')
              setShowModal(true)
            }}
            className="flex items-center gap-2 bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            <Plus size={16} />
            {activeTab === 'chain' ? 'Nouvelle chaîne' : 'Nouveau charm'}
          </button>
        </div>
      </div>

      {/* INFO LIEN SITE */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6 flex items-center gap-3">
        <Link size={16} className="text-yellow-600 flex-shrink-0" />
        <p className="text-sm text-yellow-700">
          Ces pièces apparaissent automatiquement sur la page <strong>Construis ton bijou</strong> du site client.
        </p>
      </div>

      {/* TABS */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('chain')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'chain' ? 'bg-stone-800 text-white' : 'border border-stone-300 text-stone-600 hover:bg-stone-50'}`}
        >
          Chaînes ({chains.length})
        </button>
        <button
          onClick={() => setActiveTab('charm')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'charm' ? 'bg-stone-800 text-white' : 'border border-stone-300 text-stone-600 hover:bg-stone-50'}`}
        >
          Charms ({charms.length})
        </button>
      </div>

      {loading ? (
        <p className="text-stone-400">Chargement...</p>
      ) : displayed.length === 0 ? (
        <div className="bg-white rounded-xl p-12 shadow-sm flex flex-col items-center justify-center">
          <p className="text-stone-400 font-medium">
            {activeTab === 'chain' ? 'Aucune chaîne enregistrée' : 'Aucun charm enregistré'}
          </p>
          <p className="text-stone-300 text-sm mt-1">Cliquez sur le bouton pour en ajouter</p>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-4">
          {displayed.map(part => (
            <div key={part.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
              {part.image_url ? (
                <img src={part.image_url} alt={part.name} className="w-full h-36 object-cover" />
              ) : (
                <div className="w-full h-36 bg-stone-100 flex items-center justify-center">
                  <Image size={28} className="text-stone-300" />
                </div>
              )}
              <div className="p-3">
                <div className="flex items-start justify-between mb-1">
                  <div>
                    <p className="font-semibold text-stone-800 text-sm">{part.name}</p>
                    {part.name_en && <p className="text-xs text-stone-400 italic">{part.name_en}</p>}
                  </div>
                  <button onClick={() => handleDelete(part.id)} className="p-1 text-red-400 hover:bg-red-50 rounded">
                    <Trash2 size={13} />
                  </button>
                </div>
                <p className="text-yellow-600 font-bold text-sm">{formatFCFA(part.price)}</p>
                <p className="text-stone-400 text-xs mb-2">Revient: {formatFCFA(part.cost_price)}</p>
                <div className="flex items-center gap-1">
                  <button onClick={() => updateStock(part.id, part.stock - 1)} className="w-6 h-6 rounded bg-stone-200 hover:bg-stone-300 flex items-center justify-center text-xs font-bold">-</button>
                  <span className="text-sm font-medium w-8 text-center">{part.stock}</span>
                  <button onClick={() => updateStock(part.id, part.stock + 1)} className="w-6 h-6 rounded bg-stone-200 hover:bg-stone-300 flex items-center justify-center text-xs font-bold">+</button>
                  <span className="text-xs text-stone-400 ml-1">en stock</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-stone-800 mb-4">
              {form.type === 'chain' ? 'Nouvelle chaîne' : 'Nouveau charm'}
            </h2>

            {/* Type */}
            <div className="flex gap-2 mb-4">
              <button onClick={() => setForm({ ...form, type: 'chain' })} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${form.type === 'chain' ? 'bg-stone-800 text-white' : 'border border-stone-300 text-stone-600'}`}>
                Chaîne
              </button>
              <button onClick={() => setForm({ ...form, type: 'charm' })} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${form.type === 'charm' ? 'bg-stone-800 text-white' : 'border border-stone-300 text-stone-600'}`}>
                Charm
              </button>
            </div>

            {/* Image */}
            <div className="mb-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-stone-300 rounded-xl cursor-pointer hover:border-yellow-400 transition-colors overflow-hidden"
                style={{ height: '120px' }}
              >
                {imagePreview ? (
                  <img src={imagePreview} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full">
                    <Image size={24} className="text-stone-300 mb-2" />
                    <p className="text-xs text-stone-400">Ajouter une photo</p>
                  </div>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
            </div>

            <div className="space-y-3 mb-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Nom (FR) *</label>
                  <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Nom (EN)</label>
                  <input value={form.name_en} onChange={e => setForm({ ...form, name_en: e.target.value })} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Prix de vente (FCFA) *</label>
                  <input type="number" value={form.price} onChange={e => setForm({ ...form, price: Number(e.target.value) })} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Coût de revient (FCFA)</label>
                  <input type="number" value={form.cost_price} onChange={e => setForm({ ...form, cost_price: Number(e.target.value) })} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Stock initial</label>
                <input type="number" value={form.stock} onChange={e => setForm({ ...form, stock: Number(e.target.value) })} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
              </div>
            </div>

            {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

            <div className="flex gap-3">
              <button onClick={handleSave} disabled={saving} className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50">
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