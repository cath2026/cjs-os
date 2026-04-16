'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { Download, Search, X, Printer } from 'lucide-react'
import JsBarcode from 'jsbarcode'

type BarcodeItem = {
  id: string
  barcode_value: string
  category_code?: string
  created_at: string
  variant_name: string
  product_name: string
  sale_price: number
  variant_id: string
  product_id: string
}

const SHOP_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

export default function CodesBarresPage() {
  const supabase = createClient()
  const [barcodes, setBarcodes] = useState<BarcodeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [showBarcode, setShowBarcode] = useState<BarcodeItem | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const printRef = useRef<SVGSVGElement>(null)

  const fetchBarcodes = async () => {
    const { data: variants } = await supabase
      .from('variants')
      .select('id, name, sale_price, barcode, product_id, product:products(id, name, category:categories(name, prefix))')
      .eq('shop_id', SHOP_ID)
      .eq('is_active', true)
      .not('barcode', 'is', null)

    if (!variants) { setLoading(false); return }

    const items: BarcodeItem[] = variants.map((v: any) => ({
      id: v.id,
      barcode_value: v.barcode,
      category_code: v.product?.category?.prefix,
      created_at: new Date().toISOString(),
      variant_name: v.name,
      product_name: v.product?.name || '',
      sale_price: v.sale_price,
      variant_id: v.id,
      product_id: v.product_id,
    }))

    setBarcodes(items)
    setLoading(false)
  }

  useEffect(() => { fetchBarcodes() }, [])

  useEffect(() => {
    if (showBarcode && svgRef.current) {
      try {
        JsBarcode(svgRef.current, showBarcode.barcode_value, {
          format: 'CODE128',
          width: 2,
          height: 60,
          displayValue: true,
          fontSize: 12,
          margin: 10,
        })
      } catch (e) {
        console.error('Barcode error', e)
      }
    }
  }, [showBarcode])

  const categories = [...new Set(barcodes.map(b => b.category_code).filter(Boolean))]

  const filtered = barcodes.filter(b => {
    const matchSearch =
      b.barcode_value.toLowerCase().includes(search.toLowerCase()) ||
      b.product_name.toLowerCase().includes(search.toLowerCase()) ||
      b.variant_name.toLowerCase().includes(search.toLowerCase())
    const matchCategory = categoryFilter ? b.category_code === categoryFilter : true
    return matchSearch && matchCategory
  })

  const handleExportCSV = () => {
    const csv = [
      ['Code-Barres', 'Produit', 'Variante', 'Catégorie', 'Prix'].join(','),
      ...filtered.map(b => [
        b.barcode_value,
        `"${b.product_name}"`,
        `"${b.variant_name}"`,
        b.category_code || '',
        b.sale_price,
      ].join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `codes-barres-cjs.csv`
    a.click()
  }

  const handleDownloadPNG = () => {
    if (!svgRef.current || !showBarcode) return
    const svg = svgRef.current
    const svgData = new XMLSerializer().serializeToString(svg)
    const canvas = document.createElement('canvas')
    canvas.width = svg.width.baseVal.value || 300
    canvas.height = svg.height.baseVal.value || 150
    const ctx = canvas.getContext('2d')
    const img = new Image()
    img.onload = () => {
      ctx?.drawImage(img, 0, 0)
      const a = document.createElement('a')
      a.download = `barcode-${showBarcode.barcode_value}.png`
      a.href = canvas.toDataURL('image/png')
      a.click()
    }
    img.src = 'data:image/svg+xml;base64,' + btoa(svgData)
  }

  const handlePrint = () => {
    if (!svgRef.current || !showBarcode) return
    const svg = svgRef.current.outerHTML
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <html>
        <head>
          <title>Code-Barres — ${showBarcode.product_name}</title>
          <style>
            body { font-family: sans-serif; text-align: center; padding: 20px; }
            .label { margin-bottom: 8px; font-weight: bold; font-size: 14px; }
            .sub { color: #666; font-size: 12px; margin-bottom: 12px; }
            @media print { button { display: none; } }
          </style>
        </head>
        <body>
          <div class="label">${showBarcode.product_name}</div>
          <div class="sub">${showBarcode.variant_name}</div>
          ${svg}
          <script>window.onload = () => { window.print(); window.close(); }</script>
        </body>
      </html>
    `)
    win.document.close()
  }

  const formatFCFA = (amount: number) =>
    new Intl.NumberFormat('fr-FR').format(Math.round(amount)) + ' FCFA'

  if (loading) return <div className="p-6 text-stone-400">Chargement...</div>

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-stone-800">Codes-Barres</h1>
          <p className="text-stone-500 text-sm">{barcodes.length} codes-barres générés</p>
        </div>
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 border border-stone-300 hover:bg-stone-50 text-stone-600 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Download size={14} />
          Exporter CSV
        </button>
      </div>

<div className="flex flex-col sm:flex-row gap-3 mb-4">        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par code-barres, produit ou variante..."
            className="w-full border border-stone-300 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
        >
          <option value="">Toutes les catégories</option>
          {categories.map(c => (
            <option key={c} value={c!}>{c}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr className="border-b border-stone-100">
              <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase">Code-Barres</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase">Produit</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase">Variante</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase">Catégorie</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase">Prix</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-stone-400">Aucun code-barres trouvé</td>
              </tr>
            ) : (
              filtered.map((barcode) => (
                <tr key={barcode.id} className="hover:bg-stone-50 transition-colors">
                  <td className="px-5 py-3">
                    <span className="font-mono text-sm text-stone-700">{barcode.barcode_value}</span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-sm text-stone-700">{barcode.product_name}</span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-sm text-stone-500">{barcode.variant_name}</span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                      {barcode.category_code || '—'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-sm font-medium text-stone-700">{formatFCFA(barcode.sale_price)}</span>
                  </td>
                  <td className="px-5 py-3">
                    <button
                      onClick={() => setShowBarcode(barcode)}
                      className="text-xs text-yellow-600 hover:text-yellow-700 font-medium border border-yellow-300 px-2 py-1 rounded-lg"
                    >
                      Voir
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal barcode */}
      {showBarcode && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-stone-800">Code-Barres</h2>
              <button onClick={() => setShowBarcode(null)}>
                <X size={18} className="text-stone-400" />
              </button>
            </div>

            <div className="border border-stone-200 rounded-xl p-4 mb-4 text-center">
              <p className="font-bold text-stone-800 mb-1">{showBarcode.product_name}</p>
              <p className="text-xs text-stone-400 mb-3">{showBarcode.variant_name}</p>
              <div className="flex justify-center">
                <svg ref={svgRef} />
              </div>
              <div className="mt-3 pt-3 border-t border-stone-100 text-xs text-stone-400 text-left space-y-0.5">
                <p>Catégorie: {showBarcode.category_code}</p>
                <p>Prix: {formatFCFA(showBarcode.sale_price)}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={handlePrint}
                className="flex items-center justify-center gap-1 border border-stone-300 hover:bg-stone-50 text-stone-600 py-2 rounded-lg text-xs font-medium transition-colors"
              >
                <Printer size={12} />
                Imprimer
              </button>
              <button
                onClick={handleDownloadPNG}
                className="flex items-center justify-center gap-1 border border-yellow-300 hover:bg-yellow-50 text-yellow-700 py-2 rounded-lg text-xs font-medium transition-colors"
              >
                <Download size={12} />
                PNG
              </button>
              <button
                onClick={() => navigator.clipboard.writeText(showBarcode.barcode_value)}
                className="bg-yellow-600 hover:bg-yellow-700 text-white py-2 rounded-lg text-xs font-medium transition-colors"
              >
                Copier
              </button>
            </div>

            <button
              onClick={() => setShowBarcode(null)}
              className="w-full mt-2 text-stone-400 hover:text-stone-600 text-sm py-2"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  )
}