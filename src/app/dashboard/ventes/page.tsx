'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Plus, ShoppingCart } from 'lucide-react'
import { useRouter } from 'next/navigation'

type Sale = {
  id: string
  status: string
  total: number
  customer_name?: string
  customer?: { full_name: string }
  employee?: { full_name: string }
  created_at: string
  acquisition_source?: string
  discount_amount: number
}

const SHOP_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

export default function VentesPage() {
  const supabase = createClient()
  const router = useRouter()
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  const fetchSales = async () => {
    const { data } = await supabase
      .from('sales')
      .select('*, customer:customers(full_name), employee:employees(full_name)')
      .eq('shop_id', SHOP_ID)
      .order('created_at', { ascending: false })
    setSales(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchSales() }, [])

  const formatFCFA = (amount: number) =>
    new Intl.NumberFormat('fr-FR').format(Math.round(amount)) + ' FCFA'

  const statusLabel: Record<string, string> = {
    draft: 'Brouillon',
    in_delivery: 'En livraison',
    paid: 'Payée',
    cancelled: 'Annulée',
  }

  const statusColor: Record<string, string> = {
    draft: 'bg-stone-100 text-stone-600',
    in_delivery: 'bg-blue-100 text-blue-600',
    paid: 'bg-green-100 text-green-600',
    cancelled: 'bg-red-100 text-red-500',
  }

  const filtered = filter === 'all'
    ? sales
    : sales.filter(s => s.status === filter)

  const tabs = [
    { key: 'all', label: 'Toutes' },
    { key: 'draft', label: 'Brouillon' },
    { key: 'in_delivery', label: 'En livraison' },
    { key: 'paid', label: 'Payées' },
    { key: 'cancelled', label: 'Annulées' },
  ]

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-stone-800">Ventes</h1>
          <p className="text-stone-500 text-sm">{sales.length} ventes enregistrées</p>
        </div>
        <button
          onClick={() => router.push('/dashboard/ventes/nouvelle')}
          className="flex items-center gap-2 bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Nouvelle vente
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === tab.key
                ? 'bg-yellow-600 text-white'
                : 'bg-white text-stone-600 hover:bg-stone-50 border border-stone-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-stone-400">Chargement...</p>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl p-12 shadow-sm flex flex-col items-center justify-center">
          <ShoppingCart size={48} className="text-stone-300 mb-3" />
          <p className="text-stone-400 font-medium">Aucune vente</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((sale) => (
            <div
              key={sale.id}
              onClick={() => router.push(`/dashboard/ventes/${sale.id}`)}
              className="bg-white rounded-xl p-4 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[sale.status]}`}>
                    {statusLabel[sale.status]}
                  </span>
                  <div>
                    <p className="font-medium text-stone-800">
                      {sale.customer?.full_name || sale.customer_name || 'Client anonyme'}
                    </p>
                    <p className="text-xs text-stone-400">
                      {new Date(sale.created_at).toLocaleDateString('fr-FR')} à{' '}
                      {new Date(sale.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-stone-800">{formatFCFA(sale.total)}</p>
                  {sale.discount_amount > 0 && (
                    <p className="text-xs text-red-400">-{formatFCFA(sale.discount_amount)}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}