'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import {
  LayoutDashboard, Clock, Store, Users, Tag, Package,
  Barcode, ShoppingCart, DollarSign, TrendingUp, Users2,
  UserCog, Settings, FileText, LogOut, Gem, Menu, X,
} from 'lucide-react'

type Employee = {
  id: string
  full_name: string
  role: string
  permissions: { permission_code: string; granted: boolean }[]
}

const allNavItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: null },
  { href: '/dashboard/sessions', label: 'Sessions', icon: Clock, permission: 'auth.session.view_own' },
  { href: '/dashboard/shop', label: 'Shop', icon: Store, permission: 'shop.view' },
  { href: '/dashboard/clients', label: 'Clients', icon: Users, permission: 'customers.view_list' },
  { href: '/dashboard/categories', label: 'Catégories', icon: Tag, permission: 'categories.view' },
  { href: '/dashboard/produits', label: 'Produits', icon: Package, permission: 'products.view_list' },
  { href: '/dashboard/codes-barres', label: 'Codes-Barres', icon: Barcode, permission: 'products.view_list' },
  { href: '/dashboard/ventes', label: 'Ventes', icon: ShoppingCart, permission: 'sales.view_all' },
  { href: '/dashboard/finance', label: 'Finance', icon: DollarSign, permission: 'finance.view_active_cycle' },
  { href: '/dashboard/performance', label: 'Ma Performance', icon: TrendingUp, permission: null },
  { href: '/dashboard/equipe', label: 'Équipe', icon: Users2, permission: 'dashboard.view_sales_by_employee' },
  { href: '/dashboard/employes', label: 'Employés', icon: UserCog, permission: 'employees.view_list' },
  { href: '/dashboard/parametres', label: 'Paramètres', icon: Settings, permission: 'settings.edit_language' },
  { href: '/dashboard/logs', label: 'Logs', icon: FileText, permission: 'logs.view_global' },
  { href: '/dashboard/construis', label: 'Construis', icon: Gem, permission: null },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [navItems, setNavItems] = useState(allNavItems)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    const getEmployee = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('employees')
        .select('id, full_name, role, permissions:employee_permissions(permission_code, granted)')
        .eq('auth_user_id', user.id)
        .single()
      if (data) {
        setEmployee(data)
        if (data.role === 'admin') {
          setNavItems(allNavItems)
        } else {
          const grantedPerms = data.permissions.filter((p: any) => p.granted).map((p: any) => p.permission_code)
          setNavItems(allNavItems.filter(item => item.permission === null || grantedPerms.includes(item.permission)))
        }
      }
    }
    getEmployee()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const navigate = (href: string) => {
    router.push(href)
    setSidebarOpen(false)
  }

  const Sidebar = () => (
    <div className="flex flex-col h-full bg-white">
      <div className="p-4 border-b border-stone-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-yellow-400 font-bold text-xs">CJS</span>
            </div>
            <div className="min-w-0">
              <p className="text-xs text-stone-700 font-medium truncate">{employee?.full_name}</p>
              <p className="text-xs text-stone-400 truncate capitalize">{employee?.role}</p>
            </div>
          </div>
          {/* Bouton fermer sur mobile */}
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1 text-stone-400 hover:text-stone-600">
            <X size={18} />
          </button>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          return (
            <button
              key={item.href}
              onClick={() => navigate(item.href)}
              className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm transition-colors ${
                isActive
                  ? 'bg-yellow-50 text-yellow-700 font-medium border-r-2 border-yellow-600'
                  : 'text-stone-600 hover:bg-stone-50'
              }`}
            >
              <Icon size={16} className="flex-shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          )
        })}
      </nav>

      <div className="p-3 border-t border-stone-200">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 rounded-lg transition-colors"
        >
          <LogOut size={16} />
          Déconnexion
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-stone-100 overflow-hidden">

      {/* SIDEBAR DESKTOP */}
      <aside className="hidden lg:flex w-52 flex-col border-r border-stone-200 flex-shrink-0">
        <Sidebar />
      </aside>

      {/* OVERLAY MOBILE */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR MOBILE */}
      <aside className={`fixed top-0 left-0 h-full w-64 z-50 shadow-xl transition-transform duration-300 lg:hidden ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <Sidebar />
      </aside>

      {/* MAIN */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* TOPBAR MOBILE */}
        <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-stone-200">
          <button onClick={() => setSidebarOpen(true)} className="p-1 text-stone-600">
            <Menu size={22} />
          </button>
          <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
            <span className="text-yellow-400 font-bold text-xs">CJS</span>
          </div>
          <div className="w-8" />
        </div>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}