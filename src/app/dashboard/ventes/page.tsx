'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Plus, ShoppingCart, Globe, Search } from 'lucide-react'
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

type Order = {
  id: string
  order_ref: string
  status: string
  total: number
  delivery_zone: string
  delivery_fee: number
  discount: number
  coupon_code?: string
  items: any[]
  created_at: string
  auth_user_id: string
  customer_name?: string
  customer_phone?: string
}

const SHOP_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

export default function VentesPage() {
  const supabase = createClient()
  const router = useRouter()
  const [sales, setSales] = useState<Sale[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [mainTab, setMainTab] = useState<'boutique' | 'site'>('boutique')
  const [search, setSearch] = useState('')

  const fetchSales = async () => {
    const { data } = await supabase
      .from('sales')
      .select('*, customer:customers(full_name), employee:employees(full_name)')
      .eq('shop_id', SHOP_ID)
      .order('created_at', { ascending: false })
    setSales(data || [])
  }

  const fetchOrders = async () => {
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('shop_id', SHOP_ID)
      .order('created_at', { ascending: false })
    setOrders(data || [])
  }

  useEffect(() => {
    Promise.all([fetchSales(), fetchOrders()]).then(() => setLoading(false))
  }, [])

  const formatFCFA = (amount: number) =>
    new Intl.NumberFormat('fr-FR').format(Math.round(amount)) + ' FCFA'

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('fr-FR')

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

  const orderStatusColor: Record<string, string> = {
    'commandé': 'bg-yellow-100 text-yellow-700',
    'en preparation': 'bg-blue-100 text-blue-600',
    'en livraison': 'bg-orange-100 text-orange-600',
    'livré': 'bg-green-100 text-green-600',
    'annulé': 'bg-red-100 text-red-500',
  }

  const tabs = [
    { key: 'all', label: 'Toutes' },
    { key: 'draft', label: 'Brouillon' },
    { key: 'in_delivery', label: 'Livraison' },
    { key: 'paid', label: 'Payées' },
    { key: 'cancelled', label: 'Annulées' },
  ]

  const filteredSales = sales
    .filter(s => filter === 'all' || s.status === filter)
    .filter(s => {
      if (!search) return true
      const q = search.toLowerCase()
      const name = (s.customer?.full_name || s.customer_name || '').toLowerCase()
      const date = formatDate(s.created_at)
      const total = s.total.toString()
      return name.includes(q) || date.includes(q) || total.includes(q)
    })

  const filteredOrders = orders.filter(o => {
    if (!search) return true
    const q = search.toLowerCase()
    const name = (o.customer_name || '').toLowerCase()
    const phone = (o.customer_phone || '').toLowerCase()
    const ref = o.order_ref.toLowerCase()
    const date = formatDate(o.created_at)
    const total = o.total.toString()
    return name.includes(q) || phone.includes(q) || ref.includes(q) || date.includes(q) || total.includes(q)
  })

  const updateOrderStatus = async (orderId: string, newStatus: string, order: Order) => {
    await supabase.from('orders').update({ status: newStatus }).eq('id', orderId)
    if (newStatus === 'livré') {
      await supabase.from('sales').insert({
        shop_id: SHOP_ID,
        total: order.total,
        discount_amount: order.discount || 0,
        status: 'paid',
        customer_name: order.customer_name || 'Client site',
        acquisition_source: 'site',
        notes: `Commande site #${order.order_ref}`,
      })
    }
    fetchOrders()
    fetchSales()
  }

  return (
    <div className="p-4 lg:p-6">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold text-stone-800">Ventes</h1>
          <p className="text-stone-500 text-xs">
            {sales.length} boutique · {orders.length} site
          </p>
        </div>
        {mainTab === 'boutique' && (
          <button
            onClick={() => router.push('/dashboard/ventes/nouvelle')}
            className="flex items-center gap-1.5 bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-2 rounded-lg text-xs font-medium"
          >
            <Plus size={14} /> Nouvelle vente
          </button>
        )}
      </div>

      {/* RECHERCHE */}
      <div className="relative mb-3">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={mainTab === 'boutique'
            ? 'Rechercher par client, date, montant...'
            : 'Rechercher par client, n° commande, date, montant...'
          }
          className="w-full border border-stone-200 rounded-lg pl-8 pr-4 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-yellow-400"
        />
      </div>

      {/* MAIN TABS */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setMainTab('boutique')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${mainTab === 'boutique' ? 'bg-stone-800 text-white' : 'border border-stone-300 text-stone-600 hover:bg-stone-50'}`}
        >
          <ShoppingCart size={13} />
          Boutique ({sales.length})
        </button>
        <button
          onClick={() => setMainTab('site')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${mainTab === 'site' ? 'bg-stone-800 text-white' : 'border border-stone-300 text-stone-600 hover:bg-stone-50'}`}
        >
          <Globe size={13} />
          Site ({orders.length})
          {orders.filter(o => o.status === 'commandé').length > 0 && (
            <span className="bg-yellow-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center ml-0.5">
              {orders.filter(o => o.status === 'commandé').length}
            </span>
          )}
        </button>
      </div>

      {loading ? (
        <p className="text-stone-400 text-sm">Chargement...</p>
      ) : mainTab === 'boutique' ? (
        <>
          {/* FILTRES BOUTIQUE */}
          <div className="flex gap-1.5 mb-3 flex-wrap">
            {tabs.map((tab) => (
              <button key={tab.key} onClick={() => setFilter(tab.key)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${filter === tab.key ? 'bg-yellow-600 text-white' : 'bg-white text-stone-600 border border-stone-200'}`}>
                {tab.label}
              </button>
            ))}
          </div>

          {filteredSales.length === 0 ? (
            <div className="bg-white rounded-xl p-10 shadow-sm text-center">
              <ShoppingCart size={36} className="text-stone-300 mb-2 mx-auto" />
              <p className="text-stone-400 text-sm">Aucune vente trouvée</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredSales.map((sale) => (
                <div key={sale.id} onClick={() => router.push(`/dashboard/ventes/${sale.id}`)}
                  className="bg-white rounded-xl p-3 shadow-sm cursor-pointer hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${statusColor[sale.status]}`}>
                        {statusLabel[sale.status]}
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium text-stone-800 text-sm truncate">
                          {sale.customer?.full_name || sale.customer_name || 'Client anonyme'}
                        </p>
                        <p className="text-xs text-stone-400">{formatDate(sale.created_at)}</p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      <p className="font-bold text-stone-800 text-sm">{formatFCFA(sale.total)}</p>
                      {sale.discount_amount > 0 && (
                        <p className="text-xs text-red-400">-{formatFCFA(sale.discount_amount)}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {filteredOrders.length === 0 ? (
            <div className="bg-white rounded-xl p-10 shadow-sm text-center">
              <Globe size={36} className="text-stone-300 mb-2 mx-auto" />
              <p className="text-stone-400 text-sm">Aucune commande trouvée</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredOrders.map((order) => (
                <div key={order.id} className="bg-white rounded-xl p-4 shadow-sm">

                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${orderStatusColor[order.status] || 'bg-stone-100 text-stone-600'}`}>
                          {order.status}
                        </span>
                        <p className="font-bold text-yellow-600 text-sm">#{order.order_ref}</p>
                      </div>
                      {order.customer_name && (
                        <p className="text-sm font-medium text-stone-800 truncate">{order.customer_name}</p>
                      )}
                      {order.customer_phone && (
                        <a href={`https://wa.me/${order.customer_phone.replace(/\D/g, '')}`}
                          target="_blank" rel="noreferrer"
                          className="text-xs text-green-600 hover:underline">
                          📱 {order.customer_phone}
                        </a>
                      )}
                      <p className="text-xs text-stone-400 mt-0.5">{formatDate(order.created_at)}</p>
                    </div>
                    <div className="text-right flex-shrink-0 ml-3">
                      <p className="font-bold text-stone-800">{formatFCFA(order.total)}</p>
                      <p className="text-xs text-stone-400">{order.delivery_zone}</p>
                    </div>
                  </div>

                  {/* Articles */}
                  <div className="bg-stone-50 rounded-lg p-3 mb-3">
                    {order.items?.map((item: any, i: number) => (
                      <div key={i} className="flex justify-between items-start text-xs py-1.5 border-b border-stone-100 last:border-0">
                        <div className="min-w-0 flex-1 mr-3">
                          <p className="text-stone-700 font-medium truncate">{item.name}</p>
                          <p className="text-stone-400 font-mono">{item.isCustom ? 'CJS-CUSTOM' : item.barcode || item.id}</p>
                          <p className="text-stone-400">{item.variant} · x{item.quantity}</p>
                        </div>
                        <p className="text-stone-800 font-medium flex-shrink-0">{formatFCFA(item.price * item.quantity)}</p>
                      </div>
                    ))}
                    <div className="mt-2 pt-2 border-t border-stone-200 space-y-1">
                      {order.discount > 0 && (
                        <div className="flex justify-between text-xs text-green-600">
                          <span>Réduction {order.coupon_code && `(${order.coupon_code})`}</span>
                          <span>-{formatFCFA(order.discount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-xs text-stone-500">
                        <span>Livraison</span>
                        <span>{order.delivery_fee === 0 ? 'Gratuite' : formatFCFA(order.delivery_fee)}</span>
                      </div>
                      <div className="flex justify-between text-sm font-bold text-stone-800 pt-1">
                        <span>Total</span>
                        <span>{formatFCFA(order.total)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Statut */}
                  <div>
                    <p className="text-xs text-stone-400 mb-1.5">Statut :</p>
                    <div className="flex gap-1.5 flex-wrap">
                      {['commandé', 'en preparation', 'en livraison', 'livré', 'annulé'].map(status => (
                        <button
                          key={status}
                          onClick={() => updateOrderStatus(order.id, status, order)}
                          className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                            order.status === status
                              ? 'bg-stone-800 text-white border-stone-800'
                              : 'border-stone-200 text-stone-500 hover:border-stone-400'
                          }`}
                        >
                          {status === 'livré' ? '✓ livré' : status}
                        </button>
                      ))}
                    </div>
                    {order.status === 'livré' && (
                      <p className="text-xs text-green-600 mt-1.5">✓ Vente enregistrée dans le CA</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}