'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Plus, ShoppingCart, Globe } from 'lucide-react'
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

  const filteredSales = filter === 'all' ? sales : sales.filter(s => s.status === filter)

  const tabs = [
    { key: 'all', label: 'Toutes' },
    { key: 'draft', label: 'Brouillon' },
    { key: 'in_delivery', label: 'En livraison' },
    { key: 'paid', label: 'Payées' },
    { key: 'cancelled', label: 'Annulées' },
  ]

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    await supabase.from('orders').update({ status: newStatus }).eq('id', orderId)
    fetchOrders()
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-stone-800">Ventes</h1>
          <p className="text-stone-500 text-sm">
            {sales.length} vente(s) boutique · {orders.length} commande(s) site
          </p>
        </div>
        {mainTab === 'boutique' && (
          <button
            onClick={() => router.push('/dashboard/ventes/nouvelle')}
            className="flex items-center gap-2 bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            Nouvelle vente
          </button>
        )}
      </div>

      {/* MAIN TABS */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setMainTab('boutique')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${mainTab === 'boutique' ? 'bg-stone-800 text-white' : 'border border-stone-300 text-stone-600 hover:bg-stone-50'}`}
        >
          <ShoppingCart size={14} />
          Boutique ({sales.length})
        </button>
        <button
          onClick={() => setMainTab('site')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${mainTab === 'site' ? 'bg-stone-800 text-white' : 'border border-stone-300 text-stone-600 hover:bg-stone-50'}`}
        >
          <Globe size={14} />
          Site ({orders.length})
          {orders.filter(o => o.status === 'commandé').length > 0 && (
            <span className="bg-yellow-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {orders.filter(o => o.status === 'commandé').length}
            </span>
          )}
        </button>
      </div>

      {loading ? (
        <p className="text-stone-400">Chargement...</p>
      ) : mainTab === 'boutique' ? (
        <>
          {/* FILTRES BOUTIQUE */}
          <div className="flex gap-2 mb-4 flex-wrap">
            {tabs.map((tab) => (
              <button key={tab.key} onClick={() => setFilter(tab.key)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${filter === tab.key ? 'bg-yellow-600 text-white' : 'bg-white text-stone-600 hover:bg-stone-50 border border-stone-200'}`}>
                {tab.label}
              </button>
            ))}
          </div>

          {filteredSales.length === 0 ? (
            <div className="bg-white rounded-xl p-12 shadow-sm flex flex-col items-center justify-center">
              <ShoppingCart size={48} className="text-stone-300 mb-3" />
              <p className="text-stone-400 font-medium">Aucune vente</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredSales.map((sale) => (
                <div key={sale.id} onClick={() => router.push(`/dashboard/ventes/${sale.id}`)}
                  className="bg-white rounded-xl p-4 shadow-sm cursor-pointer hover:shadow-md transition-shadow">
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
                          {new Date(sale.created_at).toLocaleDateString('fr-FR')} à {new Date(sale.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
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
        </>
      ) : (
        <>
          {/* COMMANDES SITE */}
          {orders.length === 0 ? (
            <div className="bg-white rounded-xl p-12 shadow-sm flex flex-col items-center justify-center">
              <Globe size={48} className="text-stone-300 mb-3" />
              <p className="text-stone-400 font-medium">Aucune commande site</p>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => (
                <div key={order.id} className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${orderStatusColor[order.status] || 'bg-stone-100 text-stone-600'}`}>
                        {order.status}
                      </span>
                      <div>
                        <p className="font-bold text-yellow-600 text-sm">#{order.order_ref}</p>
                        <p className="text-xs text-stone-400">
                          {new Date(order.created_at).toLocaleDateString('fr-FR')} à {new Date(order.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-stone-800">{formatFCFA(order.total)}</p>
                      <p className="text-xs text-stone-400">{order.delivery_zone}</p>
                    </div>
                  </div>

                  {/* Articles */}
                  <div className="bg-stone-50 rounded-lg p-3 mb-3">
                    {order.items?.map((item: any, i: number) => (
                      <div key={i} className="flex justify-between text-xs py-1">
                        <span className="text-stone-600">{item.name} x{item.quantity}</span>
                        <span className="text-stone-800 font-medium">{formatFCFA(item.price * item.quantity)}</span>
                      </div>
                    ))}
                    {order.discount > 0 && (
                      <div className="flex justify-between text-xs py-1 text-green-600">
                        <span>Réduction {order.coupon_code && `(${order.coupon_code})`}</span>
                        <span>-{formatFCFA(order.discount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-xs py-1 border-t border-stone-200 mt-1">
                      <span className="text-stone-500">Livraison {order.delivery_zone}</span>
                      <span>{order.delivery_fee === 0 ? 'Gratuite' : formatFCFA(order.delivery_fee)}</span>
                    </div>
                  </div>

                  {/* Changer statut */}
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-stone-400 mr-1">Statut :</p>
                    {['commandé', 'en preparation', 'en livraison', 'livré', 'annulé'].map(status => (
                      <button
                        key={status}
                        onClick={() => updateOrderStatus(order.id, status)}
                        className={`text-xs px-2 py-1 rounded-full border transition-colors ${order.status === status ? 'bg-stone-800 text-white border-stone-800' : 'border-stone-200 text-stone-500 hover:border-stone-400'}`}
                      >
                        {status}
                      </button>
                    ))}
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