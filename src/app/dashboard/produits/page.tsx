'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { Plus, Trash2, Package, Image, RefreshCw } from 'lucide-react'

type Category = { id: string; name: string; prefix: string; next_ref_number: number }
type Variant = { id: string; name: string; sale_price: number; cost_price: number; stock_quantity: number; barcode?: string }
type Product = { id: string; name: string; nameen?: string; description?: string; category_id?: string; is_active: boolean; image_url?: string; image_url_2?: string; image_url_3?: string; price?: number; stock?: number; barcode?: string; category?: Category; variants?: Variant[] }

const SHOP_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

const CATEGORIES = [
  { name: 'Bague', prefix: 'RIN' },
  { name: 'Montre', prefix: 'WAT' },
  { name: 'Gourmette', prefix: 'BAN' },
  { name: 'Bracelet', prefix: 'BRA' },
  { name: 'Chevillère', prefix: 'ANK' },
  { name: 'Ensemble', prefix: 'SET' },
  { name: 'Boucle', prefix: 'EAR' },
  { name: 'Broche', prefix: 'BRO' },
  { name: 'Chaîne', prefix: 'NEC' },
  { name: 'Lunette', prefix: 'GLA' },
  { name: 'Collier', prefix: 'COL' },
  { name: 'Homme', prefix: 'MEN' },
  { name: 'Bague S925', prefix: 'R925' },
  { name: 'Chaîne S925', prefix: 'N925' },
  { name: 'Rangement', prefix: 'STO' },
  { name: 'Accessoires cheveux', prefix: 'HAI' },
]

export default function ProduitsPage() {
  const supabase = createClient()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name: '', nameen: '', category_id: '', description: '' })
  const [variants, setVariants] = useState([
    { name: '', sale_price: 0, cost_price: 0, stock_quantity: 0 }
  ])
  const [imageFile1, setImageFile1] = useState<File | null>(null)
  const [imageFile2, setImageFile2] = useState<File | null>(null)
  const [imageFile3, setImageFile3] = useState<File | null>(null)
  const [imagePreview1, setImagePreview1] = useState<string | null>(null)
  const [imagePreview2, setImagePreview2] = useState<string | null>(null)
  const [imagePreview3, setImagePreview3] = useState<string | null>(null)
  const fileInputRef1 = useRef<HTMLInputElement>(null)
  const fileInputRef2 = useRef<HTMLInputElement>(null)
  const fileInputRef3 = useRef<HTMLInputElement>(null)

  const fetchProducts = async () => {
    const { data } = await supabase
      .from('products')
      .select('*, category:categories(id, name, prefix, next_ref_number), variants(*)')
      .eq('shop_id', SHOP_ID)
      .eq('is_active', true)
      .order('name')
    setProducts(data || [])
    setLoading(false)
  }

  const fetchCategories = async () => {
    const { data } = await supabase
      .from('categories')
      .select('*')
      .eq('shop_id', SHOP_ID)
      .eq('is_active', true)
      .order('name')
    setCategories(data || [])
  }

  useEffect(() => {
    fetchProducts()
    fetchCategories()
  }, [])

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>, slot: 1 | 2 | 3) => {
    const file = e.target.files?.[0]
    if (!file) return
    const preview = URL.createObjectURL(file)
    if (slot === 1) { setImageFile1(file); setImagePreview1(preview) }
    if (slot === 2) { setImageFile2(file); setImagePreview2(preview) }
    if (slot === 3) { setImageFile3(file); setImagePreview3(preview) }
  }

  const uploadImage = async (productId: string, file: File, slot: 1 | 2 | 3): Promise<string | null> => {
    const ext = file.name.split('.').pop()
    const path = `${productId}_${slot}.${ext}`
    const { error } = await supabase.storage.from('products').upload(path, file, { upsert: true })
    if (error) return null
    const { data } = supabase.storage.from('products').getPublicUrl(path)
    return data.publicUrl
  }

  const addVariant = () => setVariants([...variants, { name: '', sale_price: 0, cost_price: 0, stock_quantity: 0 }])

  const updateVariant = (index: number, field: string, value: string | number) => {
    const updated = [...variants]
    updated[index] = { ...updated[index], [field]: value }
    setVariants(updated)
  }

  const removeVariant = (index: number) => {
    if (variants.length === 1) return
    setVariants(variants.filter((_, i) => i !== index))
  }

  const updateStock = async (variantId: string, newQty: number, currentQty: number, productId: string) => {
    if (newQty < 0) return
    const { data: { user } } = await supabase.auth.getUser()
    const { data: empData } = await supabase.from('employees').select('id').eq('auth_user_id', user?.id).single()

    await supabase.from('variants').update({ stock_quantity: newQty, updated_at: new Date().toISOString() }).eq('id', variantId)

    await supabase.from('stock_movements').insert({
      shop_id: SHOP_ID,
      variant_id: variantId,
      employee_id: empData?.id,
      movement_type: 'adjustment',
      quantity_change: newQty - currentQty,
      quantity_before: currentQty,
      quantity_after: newQty,
      notes: 'Ajustement manuel',
    })

    const { data: allVariants } = await supabase.from('variants').select('stock_quantity').eq('product_id', productId)
    const totalStock = (allVariants || []).reduce((sum, v) => sum + v.stock_quantity, 0)
    await supabase.from('products').update({ stock: totalStock }).eq('id', productId)

    fetchProducts()
  }

  const handleSave = async () => {
    if (!form.name || !form.category_id) { setError('Nom et catégorie obligatoires'); return }
    if (variants.some(v => !v.name)) { setError('Chaque variante doit avoir un nom'); return }
    setSaving(true)
    setError('')

    const cat = categories.find(c => c.id === form.category_id)
    if (!cat) { setError('Catégorie introuvable'); setSaving(false); return }

    const totalStock = variants.reduce((sum, v) => sum + v.stock_quantity, 0)
    const minPrice = Math.min(...variants.map(v => v.sale_price))
    const firstBarcode = `CJS-${cat.prefix}-${String(cat.next_ref_number).padStart(4, '0')}`

    const { data: product, error: productError } = await supabase
      .from('products')
      .insert({
        shop_id: SHOP_ID,
        name: form.name,
        nameen: form.nameen,
        category_id: form.category_id,
        description: form.description,
        stock: totalStock,
        price: minPrice,
        barcode: firstBarcode,
        is_active: true,
      })
      .select()
      .single()

    if (productError || !product) { setError('Erreur lors de la création'); setSaving(false); return }

    const imageUrls: Record<string, string> = {}
    if (imageFile1) { const url = await uploadImage(product.id, imageFile1, 1); if (url) imageUrls.image_url = url }
    if (imageFile2) { const url = await uploadImage(product.id, imageFile2, 2); if (url) imageUrls.image_url_2 = url }
    if (imageFile3) { const url = await uploadImage(product.id, imageFile3, 3); if (url) imageUrls.image_url_3 = url }
    if (Object.keys(imageUrls).length > 0) await supabase.from('products').update(imageUrls).eq('id', product.id)

    for (let i = 0; i < variants.length; i++) {
      const refNum = cat.next_ref_number + i
      const barcode = `CJS-${cat.prefix}-${String(refNum).padStart(4, '0')}`
      await supabase.from('variants').insert({
        shop_id: SHOP_ID, product_id: product.id, name: variants[i].name,
        sale_price: variants[i].sale_price, cost_price: variants[i].cost_price,
        stock_quantity: variants[i].stock_quantity, barcode,
      })
      await supabase.from('barcodes').insert({
        shop_id: SHOP_ID, product_id: product.id, barcode_value: barcode, category_code: cat.prefix,
      })
    }

    await supabase.from('categories').update({ next_ref_number: cat.next_ref_number + variants.length }).eq('id', cat.id)

    setSaving(false)
    setShowModal(false)
    setForm({ name: '', nameen: '', category_id: '', description: '' })
    setVariants([{ name: '', sale_price: 0, cost_price: 0, stock_quantity: 0 }])
    setImageFile1(null); setImageFile2(null); setImageFile3(null)
    setImagePreview1(null); setImagePreview2(null); setImagePreview3(null)
    fetchProducts()
    fetchCategories()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce produit ?')) return
    await supabase.from('products').update({ is_active: false }).eq('id', id)
    fetchProducts()
  }

  const formatFCFA = (amount: number) =>
    new Intl.NumberFormat('fr-FR').format(Math.round(amount)) + ' FCFA'

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-stone-800">Produits & Stock</h1>
          <p className="text-stone-500 text-sm">{products.length} produits actifs</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { fetchProducts(); fetchCategories() }} className="flex items-center gap-2 border border-stone-300 text-stone-600 px-3 py-2 rounded-lg text-sm hover:bg-stone-50">
            <RefreshCw size={14} /> Actualiser
          </button>
          <button
            onClick={() => {
              setForm({ name: '', nameen: '', category_id: '', description: '' })
              setVariants([{ name: '', sale_price: 0, cost_price: 0, stock_quantity: 0 }])
              setImageFile1(null); setImageFile2(null); setImageFile3(null)
              setImagePreview1(null); setImagePreview2(null); setImagePreview3(null)
              setError('')
              setShowModal(true)
            }}
            className="flex items-center gap-2 bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} /> Nouveau produit
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-stone-400">Chargement...</p>
      ) : products.length === 0 ? (
        <div className="bg-white rounded-xl p-12 shadow-sm flex flex-col items-center justify-center">
          <Package size={48} className="text-stone-300 mb-3" />
          <p className="text-stone-400 font-medium">Aucun produit enregistré</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {products.map((product) => (
            <div key={product.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
              {product.image_url ? (
                <img src={product.image_url} alt={product.name} className="w-full h-40 object-cover" />
              ) : (
                <div className="w-full h-40 bg-stone-100 flex items-center justify-center">
                  <Image size={32} className="text-stone-300" />
                </div>
              )}
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-stone-800">{product.name}</h3>
                    {product.nameen && <p className="text-xs text-stone-400 italic">{product.nameen}</p>}
                    <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">{product.category?.name}</span>
                  </div>
                  <button onClick={() => handleDelete(product.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg">
                    <Trash2 size={14} />
                  </button>
                </div>

                {(product.image_url_2 || product.image_url_3) && (
                  <div className="flex gap-2 mb-3">
                    {product.image_url_2 && <img src={product.image_url_2} alt="" className="w-12 h-12 object-cover rounded-lg" />}
                    {product.image_url_3 && <img src={product.image_url_3} alt="" className="w-12 h-12 object-cover rounded-lg" />}
                  </div>
                )}

                <div className="mt-3 space-y-2">
                  {product.variants?.map((v) => (
                    <div key={v.id} className="bg-stone-50 rounded-lg px-3 py-2">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-stone-600 font-medium">{v.name}</span>
                        <span className="font-bold text-stone-700">{formatFCFA(v.sale_price)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1">
                          <button onClick={() => updateStock(v.id, v.stock_quantity - 1, v.stock_quantity, product.id)} className="w-5 h-5 rounded bg-stone-200 hover:bg-stone-300 flex items-center justify-center font-bold">-</button>
                          <span className="font-medium w-6 text-center">{v.stock_quantity}</span>
                          <button onClick={() => updateStock(v.id, v.stock_quantity + 1, v.stock_quantity, product.id)} className="w-5 h-5 rounded bg-stone-200 hover:bg-stone-300 flex items-center justify-center font-bold">+</button>
                          <span className="text-stone-400 ml-1">en stock</span>
                        </div>
                        <span className="text-stone-400 font-mono">{v.barcode}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-2 pt-2 border-t border-stone-100 flex justify-between text-xs text-stone-400">
                  <span>Stock total: <strong className="text-stone-600">{product.stock || 0}</strong></span>
                  <span className="font-mono">{product.barcode}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-stone-800 mb-4">Nouveau produit</h2>

            <div className="mb-4">
              <label className="block text-sm font-medium text-stone-700 mb-2">Photos du produit (3 max)</label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { slot: 1 as const, preview: imagePreview1, ref: fileInputRef1 },
                  { slot: 2 as const, preview: imagePreview2, ref: fileInputRef2 },
                  { slot: 3 as const, preview: imagePreview3, ref: fileInputRef3 },
                ]).map(({ slot, preview, ref }) => (
                  <div key={slot}>
                    <div onClick={() => ref.current?.click()} className="border-2 border-dashed border-stone-300 rounded-xl cursor-pointer hover:border-yellow-400 transition-colors overflow-hidden" style={{ height: '90px' }}>
                      {preview ? (
                        <img src={preview} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full">
                          <Image size={18} className="text-stone-300 mb-1" />
                          <p className="text-xs text-stone-400">Photo {slot}</p>
                        </div>
                      )}
                    </div>
                    <input ref={ref} type="file" accept="image/*" onChange={(e) => handleImageChange(e, slot)} className="hidden" />
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3 mb-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Nom (FR) *</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Nom (EN)</label>
                  <input value={form.nameen} onChange={(e) => setForm({ ...form, nameen: e.target.value })} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Catégorie *</label>
                <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400">
                  <option value="">Sélectionner une catégorie</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
              </div>
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-stone-700">Variantes</h3>
                <button onClick={addVariant} className="text-xs text-yellow-600 hover:text-yellow-700 font-medium">+ Ajouter</button>
              </div>
              {variants.map((variant, index) => (
                <div key={index} className="border border-stone-200 rounded-lg p-3 mb-2">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-stone-600">Variante {index + 1}</p>
                    {variants.length > 1 && <button onClick={() => removeVariant(index)} className="text-red-400 text-xs">Supprimer</button>}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-stone-500 mb-1">Nom</label>
                      <input value={variant.name} onChange={(e) => updateVariant(index, 'name', e.target.value)} placeholder="Ex: 40cm, Taille S..." className="w-full border border-stone-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-yellow-400" />
                    </div>
                    <div>
                      <label className="block text-xs text-stone-500 mb-1">Prix de vente (FCFA)</label>
                      <input type="number" value={variant.sale_price} onChange={(e) => updateVariant(index, 'sale_price', Number(e.target.value))} className="w-full border border-stone-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-yellow-400" />
                    </div>
                    <div>
                      <label className="block text-xs text-stone-500 mb-1">Coût de revient (FCFA)</label>
                      <input type="number" value={variant.cost_price} onChange={(e) => updateVariant(index, 'cost_price', Number(e.target.value))} className="w-full border border-stone-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-yellow-400" />
                    </div>
                    <div>
                      <label className="block text-xs text-stone-500 mb-1">Stock initial</label>
                      <input type="number" value={variant.stock_quantity} onChange={(e) => updateVariant(index, 'stock_quantity', Number(e.target.value))} className="w-full border border-stone-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-yellow-400" />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

            <div className="flex gap-3">
              <button onClick={handleSave} disabled={saving} className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                {saving ? 'Création...' : 'Créer le produit'}
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