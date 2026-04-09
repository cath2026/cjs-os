export type Role = 'admin' | 'responsable' | 'employe'

export type Employee = {
  id: string
  auth_user_id: string
  shop_id: string
  full_name: string
  email: string
  phone?: string
  role: Role
  pin_code?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export type Shop = {
  id: string
  name: string
  address?: string
  city: string
  country: string
  currency: string
  phone?: string
  email?: string
  description?: string
  logo_url?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export type Category = {
  id: string
  shop_id: string
  name: string
  prefix: string
  description?: string
  next_ref_number: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export type Product = {
  id: string
  shop_id: string
  category_id?: string
  name: string
  description?: string
  image_url?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export type Variant = {
  id: string
  product_id: string
  shop_id: string
  name: string
  sku?: string
  barcode?: string
  sale_price: number
  cost_price: number
  stock_quantity: number
  stock_reserved: number
  low_stock_threshold: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export type Customer = {
  id: string
  shop_id: string
  full_name: string
  email?: string
  phone?: string
  address?: string
  notes?: string
  total_spent: number
  total_orders: number
  preferred_category_id?: string
  created_at: string
  updated_at: string
}

export type SaleStatus = 'draft' | 'in_delivery' | 'paid' | 'cancelled'

export type AcquisitionSource =
  | 'TikTok'
  | 'WhatsApp'
  | 'Facebook'
  | 'Instagram'
  | 'Boutique'
  | 'Recommandation'
  | 'Autre'

export type Sale = {
  id: string
  shop_id: string
  employee_id?: string
  customer_id?: string
  customer_name?: string
  status: SaleStatus
  acquisition_source?: AcquisitionSource
  payment_method?: string
  subtotal: number
  discount_type?: 'fixed' | 'percent'
  discount_value: number
  discount_amount: number
  total: number
  notes?: string
  paid_at?: string
  created_at: string
  updated_at: string
}

export type SaleItem = {
  id: string
  sale_id: string
  variant_id?: string
  product_id?: string
  product_name: string
  variant_name?: string
  quantity: number
  unit_price: number
  unit_cost: number
  total_price: number
  created_at: string
}

export type FinanceCycle = {
  id: string
  shop_id: string
  started_at: string
  closed_at?: string
  is_active: boolean
  total_sales: number
  gross_revenue: number
  net_revenue: number
  gross_margin: number
  net_margin: number
  fixed_costs_total: number
  created_at: string
}

export type FixedCosts = {
  id: string
  shop_id: string
  cycle_id: string
  salary: number
  bonus: number
  commission: number
  invoices: number
  internet: number
  unexpected: number
  other: number
  total: number
  updated_at: string
}

export type DistributionRules = {
  id: string
  shop_id: string
  reinvestment_pct: number
  marketing_pct: number
  savings_pct: number
  owner_pct: number
  tithe_pct: number
  unexpected_pct: number
  updated_at: string
}

export type Log = {
  id: string
  shop_id: string
  employee_id?: string
  employee_name?: string
  action: string
  module?: string
  reference_id?: string
  details?: Record<string, unknown>
  created_at: string
}

export type PerformanceGoal = {
  id: string
  employee_id: string
  shop_id: string
  cycle_id?: string
  target_revenue: number
  achieved_revenue: number
  achievement_rate: number
  updated_at: string
}

export type Permission = {
  id: string
  code: string
  label: string
  module: string
  description?: string
  created_at: string
}

export type EmployeePermission = {
  id: string
  employee_id: string
  permission_code: string
  granted: boolean
  created_at: string
}