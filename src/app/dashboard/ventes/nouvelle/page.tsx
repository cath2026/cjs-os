'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Trash2, Search, X, Camera } from 'lucide-react'

type Customer = { id: string; full_name: string; phone?: string }
type Variant = { id: string; name: string; sale_price: number; cost_price: number; stock_quantity: number; barcode?: string; product: { id: string; name: string } }
type CartItem = { variant_id: string; product_id: string; product_name: string; variant_name: string; quantity: number; unit_price: number; unit_cost: number }
type PaymentMethod = { id: string; name: string }

const SHOP_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

export default function NouvelleVentePage() {
  const supabase = createClient()
  const router = useRouter()

  const [customers, setCustomers] = useState<Customer[]>([])
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [allVariants, setAllVariants] = useState<Variant[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [barcode, setBarcode] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [customerName, setCustomerName] = useState('')
  const [source, setSource] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [discountType, setDiscountType] = useState('')
  const [discountValue, setDiscountValue] = useState(0)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([])
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [showProductModal, setShowProductModal] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  const [showCamera, setShowCamera] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      const { data: custs } = await supabase
        .from('customers')
        .select('id, full_name, phone')
        .eq('shop_id', SHOP_ID)
        .order('full_name')
      setCustomers(custs || [])

      const { data: pm } = await supabase
        .from('payment_methods')
        .select('*')
        .eq('shop_id', SHOP_ID)
        .eq('is_active', true)
      setPaymentMethods(pm || [])

      const { data: variants } = await supabase
        .from('variants')
        .select('*, product:products(id, name)')
        .eq('shop_id', SHOP_ID)
        .eq('is_active', true)
      setAllVariants(variants || [])
    }
    fetchData()
  }, [])

  useEffect(() => {
    if (!showCamera) return

    let scanner: any = null

    const startScanner = async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode')
        scanner = new Html5Qrcode('qr-reader')
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText: string) => {
            setBarcode(decodedText)
            setShowCamera(false)
            scanner.stop()
            const found = allVariants.find(v => v.barcode === decodedText)
            if (found) {
              addToCart(found)
              setError('')
            } else {
              setError('Produit non trouvé pour ce code-barres')
            }
          },
          () => {}
        )
      } catch (err) {
        setError('Impossible d\'accéder à la caméra')
        setShowCamera(false)
      }
    }

    startScanner()

    return () => {
      if (scanner) {
        scanner.stop().catch(() => {})
      }
    }
  }, [showCamera])

  const handleBarcodeSearch = () => {
    if (!barcode.trim()) return
    const found = allVariants.find(v => v.barcode === barcode.trim())
    if (!found) {
      setError('Produit non trouvé')
      return
    }
    setError('')
    addToCart(found)
    setBarcode('')
  }

  const addToCart = (variant: Variant) => {
    const existing = cart.find(i => i.variant_id === variant.id)
    if (existing) {
      setCart(cart.map(i =>
        i.variant_id === variant.id
          ? { ...i, quantity: i.quantity + 1 }
          : i
      ))
    } else {
      setCart([...cart, {
        variant_id: variant.id,
        product_id: variant.product.id,
        product_name: variant.product.name,
        variant_name: variant.name,
        quantity: 1,
        unit_price: variant.sale_price,
        unit_cost: variant.cost_price,
      }])
    }
    setShowProductModal(false)
    setProductSearch('')
  }

  const updateQty = (variant_id: string, qty: number) => {
    if (qty <= 0) {
      setCart(cart.filter(i => i.variant_id !== variant_id))
    } else {
      setCart(cart.map(i => i.variant_id === variant_id ? { ...i, quantity: qty } : i))
    }
  }

  const subtotal = cart.reduce((sum, i) => sum + i.unit_price * i.quantity, 0)
  const discountAmount = discountType === 'fixed'
    ? discountValue
    : discountType === 'percent'
    ? (subtotal * discountValue) / 100
    : 0
  const total = subtotal - discountAmount

  const handleSave = async (status: string) => {
    if (cart.length === 0) {
      setError('Ajoutez au moins un article')
      return
    }
    if (!source) {
      setError('La source d\'acquisition est obligatoire')
      return
    }
    setSaving(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    const { data: empData } = await supabase
      .from('employees')
      .select('id')
      .eq('auth_user_id', user?.id)
      .single()

    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert({
        shop_id: SHOP_ID,
        employee_id: empData?.id,
        customer_id: selectedCustomer?.id || null,
        customer_name: selectedCustomer ? null : customerName || null,
        status,
        acquisition_source: source || null,
        payment_method: paymentMethod || null,
        subtotal,
        discount_type: discountType || null,
        discount_value: discountValue,
        discount_amount: discountAmount,
        total,
        notes: notes || null,
        paid_at: status === 'paid' ? new Date().toISOString() : null,
      })
      .select()
      .single()

    if (saleError || !sale) {
      setError('Erreur lors de la création')
      setSaving(false)
      return
    }

    const { error: itemsError } = await supabase.from('sale_items').insert(
      cart.map(item => ({
        sale_id: sale.id,
        variant_id: item.variant_id,
        product_id: item.product_id,
        product_name: item.product_name,
        variant_name: item.variant_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        unit_cost: item.unit_cost,
        total_price: item.unit_price * item.quantity,
      }))
    )

    if (itemsError) {
      setError('Stock insuffisant pour un ou plusieurs articles')
      await supabase.from('sales').delete().eq('id', sale.id)
      setSaving(false)
      return
    }

    router.push('/dashboard/ventes')
  }

  const handleCustomerSearch = (value: string) => {
    setCustomerSearch(value)
    setSelectedCustomer(null)
    if (value.length > 0) {
      const filtered = customers.filter(c =>
        c.full_name.toLowerCase().includes(value.toLowerCase()) ||
        c.phone?.includes(value)
      )
      setFilteredCustomers(filtered)
      setShowCustomerDropdown(true)
    } else {
      setShowCustomerDropdown(false)
    }
  }

  const filteredVariants = allVariants.filter(v =>
    v.product.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    v.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    v.barcode?.includes(productSearch)
  )

  const formatFCFA = (amount: number) =>
    new Intl.NumberFormat('fr-FR').format(Math.round(amount)) + ' FCFA'

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-2 hover:bg-stone-100 rounded-lg">
          <ArrowLeft size={18} className="text-stone-600" />
        </button>
        <div>
          <h1 className="text-2xl font-semibold text-stone-800">Nouvelle vente</h1>
          <p className="text-stone-500 text-sm">Créer une nouvelle vente</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Colonne gauche */}
        <div className="space-y-4">
          {/* Client */}
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <h2 className="font-semibold text-stone-700 mb-3">Client</h2>
            <div className="relative mb-3">
              <input
                value={customerSearch}
                onChange={(e) => handleCustomerSearch(e.target.value)}
                placeholder="Rechercher un client existant..."
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
              {showCustomerDropdown && filteredCustomers.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white border border-stone-200 rounded-lg shadow-lg z-10 max-h-40 overflow-y-auto">
                  {filteredCustomers.map(c => (
                    <button
                      key={c.id}
                      onClick={() => {
                        setSelectedCustomer(c)
                        setCustomerSearch(c.full_name)
                        setShowCustomerDropdown(false)
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-stone-50"
                    >
                      {c.full_name} {c.phone && `— ${c.phone}`}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="text-xs text-stone-400 text-center mb-2">ou</p>
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Nom du client (nouveau)..."
              disabled={!!selectedCustomer}
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 disabled:bg-stone-50"
            />

            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <label className="block text-xs text-stone-500 mb-1">Source d'acquisition *</label>
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                >
                  <option value="">Sélectionner...</option>
                  {['TikTok','WhatsApp','Facebook','Instagram','Boutique','Recommandation','Autre'].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-stone-500 mb-1">Méthode de paiement</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                >
                  <option value="">Sélectionner...</option>
                  {paymentMethods.map(pm => (
                    <option key={pm.id} value={pm.name}>{pm.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Scanner */}
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <h2 className="font-semibold text-stone-700 mb-3">Scanner un code-barres</h2>
            <div className="flex gap-2 mb-2">
              <input
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleBarcodeSearch()}
                placeholder="Scannez ou entrez le code-barres..."
                className="flex-1 border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
              <button
                onClick={handleBarcodeSearch}
                className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
              >
                <Search size={16} />
              </button>
              <button
                onClick={() => setShowCamera(!showCamera)}
                title="Scanner avec la caméra"
                className={`px-4 py-2 rounded-lg text-sm transition-colors border ${
                  showCamera
                    ? 'bg-red-50 border-red-300 text-red-500'
                    : 'border-stone-300 hover:bg-stone-50 text-stone-600'
                }`}
              >
                <Camera size={16} />
              </button>
            </div>

            {showCamera && (
              <div className="mb-2 rounded-lg overflow-hidden border border-stone-200">
                <div id="qr-reader" className="w-full" />
              </div>
            )}

            {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
            <p className="text-xs text-stone-400 mt-2">
              Astuce : Si vous scannez le même produit plusieurs fois, la quantité augmente automatiquement.
            </p>
          </div>
        </div>

        {/* Colonne droite */}
        <div className="space-y-4">
          {/* Articles */}
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-stone-700">Articles</h2>
              <button
                onClick={() => setShowProductModal(true)}
                className="flex items-center gap-1 text-xs text-yellow-600 hover:text-yellow-700 font-medium border border-yellow-300 px-2 py-1 rounded-lg"
              >
                <Plus size={12} /> Ajouter manuellement
              </button>
            </div>

            {cart.length === 0 ? (
              <p className="text-stone-400 text-sm text-center py-6">Aucun article ajouté</p>
            ) : (
              <div className="space-y-2">
                {cart.map((item) => (
                  <div key={item.variant_id} className="flex items-center gap-3 bg-stone-50 rounded-lg px-3 py-2">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-stone-700">{item.product_name}</p>
                      <p className="text-xs text-stone-400">{item.variant_name} — {formatFCFA(item.unit_price)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQty(item.variant_id, item.quantity - 1)}
                        className="w-6 h-6 rounded-full bg-stone-200 hover:bg-stone-300 flex items-center justify-center text-sm"
                      >-</button>
                      <span className="text-sm font-medium w-4 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateQty(item.variant_id, item.quantity + 1)}
                        className="w-6 h-6 rounded-full bg-stone-200 hover:bg-stone-300 flex items-center justify-center text-sm"
                      >+</button>
                    </div>
                    <p className="text-sm font-bold text-stone-800 w-24 text-right">
                      {formatFCFA(item.unit_price * item.quantity)}
                    </p>
                    <button
                      onClick={() => setCart(cart.filter(i => i.variant_id !== item.variant_id))}
                      className="text-red-400 hover:text-red-500"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Réduction */}
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <h2 className="font-semibold text-stone-700 mb-3">Réduction</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-stone-500 mb-1">Type</label>
                <select
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value)}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                >
                  <option value="">Aucune réduction</option>
                  <option value="fixed">Montant fixe (FCFA)</option>
                  <option value="percent">Pourcentage (%)</option>
                </select>
              </div>
              {discountType && (
                <div>
                  <label className="block text-xs text-stone-500 mb-1">
                    Valeur {discountType === 'percent' ? '(%)' : '(FCFA)'}
                  </label>
                  <input
                    type="number"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(Number(e.target.value))}
                    className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <h2 className="font-semibold text-stone-700 mb-3">Notes</h2>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes additionnelles..."
              rows={2}
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
            />
          </div>

          {/* Total */}
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <div className="flex justify-between text-sm text-stone-500 mb-1">
              <span>Sous-total</span>
              <span>{formatFCFA(subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-sm text-red-400 mb-1">
                <span>Réduction</span>
                <span>-{formatFCFA(discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-stone-800 text-lg border-t border-stone-100 pt-2 mt-2">
              <span>Total</span>
              <span>{formatFCFA(total)}</span>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-4">
              <button
                onClick={() => handleSave('draft')}
                disabled={saving}
                className="border border-stone-300 hover:bg-stone-50 text-stone-600 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                Brouillon
              </button>
              <button
                onClick={() => handleSave('in_delivery')}
                disabled={saving}
                className="border border-blue-300 hover:bg-blue-50 text-blue-600 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                En livraison
              </button>
              <button
                onClick={() => handleSave('paid')}
                disabled={saving}
                className="bg-yellow-600 hover:bg-yellow-700 text-white py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {saving ? '...' : 'Payée'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal ajout produit manuel */}
      {showProductModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-stone-800">Ajouter un produit</h2>
              <button onClick={() => setShowProductModal(false)}>
                <X size={18} className="text-stone-400" />
              </button>
            </div>

            <input
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="Rechercher par nom ou code-barres..."
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 mb-3"
              autoFocus
            />

            <div className="max-h-80 overflow-y-auto space-y-2">
              {filteredVariants.length === 0 ? (
                <p className="text-stone-400 text-sm text-center py-4">Aucun produit trouvé</p>
              ) : (
                filteredVariants.map((variant) => (
                  <button
                    key={variant.id}
                    onClick={() => addToCart(variant)}
                    className="w-full flex items-center justify-between bg-stone-50 hover:bg-yellow-50 rounded-lg px-3 py-2.5 transition-colors"
                  >
                    <div className="text-left">
                      <p className="text-sm font-medium text-stone-700">{variant.product.name}</p>
                      <p className="text-xs text-stone-400">{variant.name} — {variant.barcode}</p>
                      <p className="text-xs text-stone-400">Stock: {variant.stock_quantity}</p>
                    </div>
                    <p className="text-sm font-bold text-stone-800">{formatFCFA(variant.sale_price)}</p>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}