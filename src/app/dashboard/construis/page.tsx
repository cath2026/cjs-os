'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { Plus, Trash2, RefreshCw, Link } from 'lucide-react'

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
    price: '',
    cost_price: '',
    stock: '',
  })
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchParts = async () => {
    setLoading(true)
    const { data, error: fetchError } = await supabase
      .from('custom_parts')
      .select('*')
      .eq('shop_id', SHOP_ID)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
    if (fetchError) console.error('Fetch error:', fetchError)
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
    if (error) { console.error('Upload error:', error); return null }
    const { data } = supabase.storage.from('products').getPublicUrl(path)
    return data.publicUrl
  }

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Nom obligatoire'); return }
    if (!form.price || Number(form.price) <= 0) { setError('Prix de vente obligatoire'); return }
    setSaving(true)
    setError('')

    const insertData = {
      shop_id: SHOP_ID,
      type: form.type,
      name: form.name.trim(),
      name_en: form.name_en.trim() || null,
      price: Number(form.price),
      cost_price: Number(form.cost_price) || 0,
      stock: Number(form.stock) || 0,
      is_active: true,
    }

    const { data: part, error: partError } = await supabase
      .from('custom_parts')
      .insert(insertData)
      .select()
      .single()

    if (partError || !part) {
      console.error('Insert error:', partError)
      setError('Erreur lors de la création: ' + (partError?.message || 'inconnue'))
      setSaving(false)
      return
    }

    if (imageFile) {
      const url = await uploadImage(part.id)
      if (url) {
        await supabase.from('custom_parts').update({ image_url: url }).eq('id', part.id)
      }
    }

    setSaving(false)
    setShowModal(false)
    setForm({ type: activeTab, name: '', name_en: '', price: '', cost_price: '', stock: '' })
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
    await supabase.from('custom_parts').update({ stock: newStock }).eq('id', id)
    setParts(prev => prev.map(p => p.id === id ? { ...p, stock: newStock } : p))
  }

  const openModal = () => {
    setForm({ type: activeTab, name: '', name_en: '', price: '', cost_price: '', stock: '' })
    setImageFile(null)
    setImagePreview(null)
    setError('')
    setShowModal(true)
  }

  const chains = parts.filter(p => p.type === 'chain')
  const charms = parts.filter(p => p.type === 'charm')
  const displayed = activeTab === 'chain' ? chains : charms

  const formatFCFA = (amount: number) => new Intl.NumberFormat('fr-FR').format(Math.round(amount)) + ' FCFA'

  return (
    <div className="p-4 lg:p-6">
      <style>{`
        .parts-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
        }
        @media (max-width: 1024px) { .parts-grid { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 640px) { .parts-grid { grid-template-columns: repeat(2, 1fr); gap: 8px; } }
        .stock-btn { width: 26px; height: 26px; border-radius: 6px; border: 1px solid #e7e5e4; background: white; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: bold; color: #57534e; }
        .stock-btn:hover { background: #f5f5f4; }
      `}</style>

      {/* HEADER */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-semibold text-stone-800">Construis ton bijou</h1>
          <p className="text-stone-500 text-xs">{chains.length} chaîne(s) · {charms.length} charm(s)</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchParts} className="flex items-center gap-1.5 border border-stone-200 text-stone-500 px-3 py-2 rounded-lg text-xs hover:bg-stone-50">
            <RefreshCw size={13} /> Actualiser
          </button>
          <button onClick={openModal} className="flex items-center gap-1.5 bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-2 rounded-lg text-xs font-medium">
            <Plus size={13} />
            {activeTab === 'chain' ? 'Nouvelle chaîne' : 'Nouveau charm'}
          </button>
        </div>
      </div>

      {/* INFO */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-4 flex items-center gap-2">
        <Link size={14} className="text-yellow-600 flex-shrink-0" />
        <p className="text-xs text-yellow-700">
          Ces pièces apparaissent automatiquement sur la page <strong>Construis ton bijou</strong> du site client.
        </p>
      </div>

      {/* TABS */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setActiveTab('chain')}
          className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors ${activeTab === 'chain' ? 'bg-stone-800 text-white' : 'border border-stone-300 text-stone-600 hover:bg-stone-50'}`}>
          Chaînes ({chains.length})
        </button>
        <button onClick={() => setActiveTab('charm')}
          className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors ${activeTab === 'charm' ? 'bg-stone-800 text-white' : 'border border-stone-300 text-stone-600 hover:bg-stone-50'}`}>
          Charms ({charms.length})
        </button>
      </div>

      {/* GRILLE */}
      {loading ? (
        <p className="text-stone-400 text-sm">Chargement...</p>
      ) : displayed.length === 0 ? (
        <div className="bg-white rounded-xl p-10 shadow-sm text-center">
          <p className="text-stone-400 text-sm font-medium">
            {activeTab === 'chain' ? 'Aucune chaîne enregistrée' : 'Aucun charm enregistré'}
          </p>
          <p className="text-stone-300 text-xs mt-1">Cliquez sur le bouton pour en ajouter</p>
          <button onClick={openModal} className="mt-4 flex items-center gap-1.5 bg-yellow-600 text-white px-4 py-2 rounded-lg text-xs font-medium mx-auto">
            <Plus size={13} /> Ajouter
          </button>
        </div>
      ) : (
        <div className="parts-grid">
          {displayed.map(part => (
            <div key={part.id} className="bg-white rounded-xl shadow-sm overflow-hidden border border-stone-100">
              {part.image_url ? (
                <img src={part.image_url} alt={part.name} className="w-full aspect-square object-cover" />
              ) : (
                <div className="w-full aspect-square bg-stone-100 flex items-center justify-center">
                  <span style={{ fontSize: '32px' }}>{part.type === 'chain' ? '⛓️' : '✨'}</span>
                </div>
              )}
              <div className="p-3">
                <div className="flex items-start justify-between mb-1">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-stone-800 text-xs leading-tight truncate">{part.name}</p>
                    {part.name_en && <p className="text-xs text-stone-400 italic truncate">{part.name_en}</p>}
                  </div>
                  <button onClick={() => handleDelete(part.id)} className="p-1 text-red-400 hover:bg-red-50 rounded flex-shrink-0 ml-1">
                    <Trash2 size={11} />
                  </button>
                </div>
                <p className="text-yellow-600 font-bold text-xs">{formatFCFA(part.price)}</p>
                <p className="text-stone-400 text-xs mb-2">Revient: {formatFCFA(part.cost_price)}</p>
                <div className="flex items-center gap-1">
                  <button onClick={() => updateStock(part.id, part.stock - 1)} className="stock-btn">−</button>
                  <span className={`text-xs font-bold w-8 text-center ${part.stock === 0 ? 'text-red-500' : 'text-stone-700'}`}>{part.stock}</span>
                  <button onClick={() => updateStock(part.id, part.stock + 1)} className="stock-btn">+</button>
                  <span className="text-xs text-stone-400 ml-1">stock</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL CRÉATION */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl p-5 w-full sm:max-w-md shadow-xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-stone-800">
                {form.type === 'chain' ? 'Nouvelle chaîne' : 'Nouveau charm'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-stone-400 text-xl leading-none">✕</button>
            </div>

            {/* Type */}
            <div className="flex gap-2 mb-4">
              <button onClick={() => setForm({ ...form, type: 'chain' })}
                className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${form.type === 'chain' ? 'bg-stone-800 text-white' : 'border border-stone-300 text-stone-600'}`}>
                Chaîne
              </button>
              <button onClick={() => setForm({ ...form, type: 'charm' })}
                className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${form.type === 'charm' ? 'bg-stone-800 text-white' : 'border border-stone-300 text-stone-600'}`}>
                Charm
              </button>
            </div>

            {/* Image */}
            <div className="mb-4">
              <div onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-stone-300 rounded-xl cursor-pointer hover:border-yellow-400 transition-colors overflow-hidden"
                style={{ height: '110px' }}>
                {imagePreview ? (
                  <img src={imagePreview} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full">
                    <span style={{ fontSize: '28px' }}>{form.type === 'chain' ? '⛓️' : '✨'}</span>
                    <p className="text-xs text-stone-400 mt-1">Ajouter une photo</p>
                  </div>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
            </div>

            <div className="space-y-3 mb-4">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">Nom (FR) *</label>
                  <input
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder="Ex: Chaîne serpent"
                    className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">Nom (EN)</label>
                  <input
                    value={form.name_en}
                    onChange={e => setForm({ ...form, name_en: e.target.value })}
                    placeholder="Ex: Snake chain"
                    className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">Prix vente (FCFA) *</label>
                  <input
                    type="number"
                    value={form.price}
                    onChange={e => setForm({ ...form, price: e.target.value })}
                    placeholder="0"
                    className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">Coût revient (FCFA)</label>
                  <input
                    type="number"
                    value={form.cost_price}
                    onChange={e => setForm({ ...form, cost_price: e.target.value })}
                    placeholder="0"
                    className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">Stock initial</label>
                <input
                  type="number"
                  value={form.stock}
                  onChange={e => setForm({ ...form, stock: e.target.value })}
                  placeholder="0"
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </div>
            </div>

            {error && <p className="text-red-500 text-xs mb-3 bg-red-50 p-2 rounded-lg">{error}</p>}

            <div className="flex gap-2">
              <button onClick={handleSave} disabled={saving}
                className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
                {saving ? 'Création...' : 'Créer'}
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