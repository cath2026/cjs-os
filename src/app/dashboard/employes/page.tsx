'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Plus, UserCog, X, Shield, Pencil, Save, Check } from 'lucide-react'

type Employee = {
  id: string
  full_name: string
  email: string
  phone?: string
  role: string
  pin_code?: string
  is_active: boolean
  created_at: string
  permissions?: { permission_code: string; granted: boolean }[]
}

type Permission = {
  id: string
  code: string
  label: string
  module: string
}

const SHOP_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

export default function EmployesPage() {
  const supabase = createClient()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showPermModal, setShowPermModal] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    role: 'responsable',
    pin_code: '',
    pin_confirm: '',
  })
  const [editForm, setEditForm] = useState({
    full_name: '',
    phone: '',
    role: '',
    pin_code: '',
  })
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([])
  const [editPermissions, setEditPermissions] = useState<string[]>([])

  const fetchData = async () => {
    const { data: emps } = await supabase
      .from('employees')
      .select('*, permissions:employee_permissions(permission_code, granted)')
      .eq('shop_id', SHOP_ID)
      .eq('is_active', true)
      .order('created_at')
    setEmployees(emps || [])

    const { data: perms } = await supabase
      .from('permissions')
      .select('*')
      .order('module')
    setPermissions(perms || [])

    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const groupedPermissions = permissions.reduce((acc, perm) => {
    if (!acc[perm.module]) acc[perm.module] = []
    acc[perm.module].push(perm)
    return acc
  }, {} as Record<string, Permission[]>)

  const togglePermission = (code: string, list: string[], setList: (v: string[]) => void) => {
    setList(list.includes(code) ? list.filter(p => p !== code) : [...list, code])
  }

  const toggleModule = (module: string, list: string[], setList: (v: string[]) => void) => {
    const moduleCodes = groupedPermissions[module].map(p => p.code)
    const allSelected = moduleCodes.every(c => list.includes(c))
    if (allSelected) {
      setList(list.filter(p => !moduleCodes.includes(p)))
    } else {
      setList([...new Set([...list, ...moduleCodes])])
    }
  }

  const handleSave = async () => {
    if (!form.full_name || !form.email || !form.password || !form.pin_code) {
      setError('Tous les champs obligatoires doivent être remplis')
      return
    }
    if (form.pin_code !== form.pin_confirm) {
      setError('Les codes PIN ne correspondent pas')
      return
    }
    setSaving(true)
    setError('')

    const { error: fnError } = await supabase.rpc('create_employee_with_auth', {
      p_email: form.email,
      p_password: form.password,
      p_full_name: form.full_name,
      p_phone: form.phone || null,
      p_role: form.role,
      p_pin_code: form.pin_code,
      p_shop_id: SHOP_ID,
      p_permissions: selectedPermissions,
    })

    if (fnError) {
      setError('Erreur : ' + fnError.message)
      setSaving(false)
      return
    }

    setSaving(false)
    setShowModal(false)
    setForm({ full_name: '', email: '', phone: '', password: '', role: 'responsable', pin_code: '', pin_confirm: '' })
    setSelectedPermissions([])
    fetchData()
  }

  const handleEdit = async () => {
    if (!editingEmployee) return
    setSaving(true)

    await supabase
      .from('employees')
      .update({
        full_name: editForm.full_name,
        phone: editForm.phone || null,
        role: editForm.role,
        pin_code: editForm.pin_code || editingEmployee.pin_code,
        updated_at: new Date().toISOString(),
      })
      .eq('id', editingEmployee.id)

    setSaving(false)
    setShowEditModal(false)
    fetchData()
  }

  const handleSavePermissions = async () => {
    if (!editingEmployee) return
    setSaving(true)

    // Supprimer toutes les permissions existantes
    await supabase
      .from('employee_permissions')
      .delete()
      .eq('employee_id', editingEmployee.id)

    // Réinsérer les nouvelles permissions
    if (editPermissions.length > 0) {
      await supabase.from('employee_permissions').insert(
        editPermissions.map(code => ({
          employee_id: editingEmployee.id,
          permission_code: code,
          granted: true,
        }))
      )
    }

    await supabase.from('logs').insert({
      shop_id: SHOP_ID,
      action: `Permissions modifiées pour : ${editingEmployee.full_name}`,
      module: 'employees',
    })

    setSaving(false)
    setShowPermModal(false)
    fetchData()
  }

  const handleDisable = async (id: string) => {
    if (!confirm('Désactiver cet employé ?')) return
    await supabase.from('employees').update({ is_active: false }).eq('id', id)
    fetchData()
  }

  const openEdit = (emp: Employee) => {
    setEditingEmployee(emp)
    setEditForm({
      full_name: emp.full_name,
      phone: emp.phone || '',
      role: emp.role,
      pin_code: '',
    })
    setShowEditModal(true)
  }

  const openPermissions = (emp: Employee) => {
    setEditingEmployee(emp)
    const currentPerms = emp.permissions
      ?.filter(p => p.granted)
      .map(p => p.permission_code) || []
    setEditPermissions(currentPerms)
    setShowPermModal(true)
  }

  const roleLabel: Record<string, string> = {
    admin: 'Administrateur',
    responsable: 'Responsable',
    employe: 'Employé',
  }

  const roleColor: Record<string, string> = {
    admin: 'bg-yellow-100 text-yellow-700',
    responsable: 'bg-blue-100 text-blue-600',
    employe: 'bg-stone-100 text-stone-600',
  }

  if (loading) return <div className="p-6 text-stone-400">Chargement...</div>

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-stone-800">Gestion des Employés</h1>
          <p className="text-stone-500 text-sm">{employees.length} employés</p>
        </div>
        <button
          onClick={() => {
            setForm({ full_name: '', email: '', phone: '', password: '', role: 'responsable', pin_code: '', pin_confirm: '' })
            setSelectedPermissions([])
            setError('')
            setShowModal(true)
          }}
          className="flex items-center gap-2 bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Nouvel employé
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols_2 gap-4">
        {employees.map((emp) => (
          <div key={emp.id} className="bg-white rounded-xl p-5 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
                  <UserCog size={18} className="text-yellow-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-stone-800">{emp.full_name}</h3>
                  <p className="text-xs text-stone-400">{emp.email}</p>
                </div>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleColor[emp.role]}`}>
                {roleLabel[emp.role]}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs text-stone-400 mb-3">
              <span>Code PIN : {'•'.repeat(4)}</span>
              <span>
                {emp.role === 'admin'
                  ? 'Accès total'
                  : `${emp.permissions?.filter(p => p.granted).length || 0} permissions`
                }
              </span>
            </div>

            <p className="text-xs text-stone-400 mb-3">
              Créé le {new Date(emp.created_at).toLocaleDateString('fr-FR')}
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => openEdit(emp)}
                className="flex-1 flex items-center justify-center gap-1 border border-stone-300 hover:bg-stone-50 text-stone-600 py-1.5 rounded-lg text-xs transition-colors"
              >
                <Pencil size={12} />
                Modifier
              </button>
              {emp.role !== 'admin' && (
                <>
                  <button
                    onClick={() => openPermissions(emp)}
                    className="flex-1 flex items-center justify-center gap-1 border border-blue-300 hover:bg-blue-50 text-blue-600 py-1.5 rounded-lg text-xs transition-colors"
                  >
                    <Shield size={12} />
                    Permissions
                  </button>
                  <button
                    onClick={() => handleDisable(emp.id)}
                    className="flex-1 border border-red-200 hover:bg-red-50 text-red-500 py-1.5 rounded-lg text-xs transition-colors"
                  >
                    Désactiver
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Modal nouvel employé */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl p-5 w-full sm:max-w-2xl shadow-xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-stone-800">Nouvel employé</h2>
              <button onClick={() => setShowModal(false)}>
                <X size={18} className="text-stone-400" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Nom complet *</label>
                <input
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Email *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Téléphone</label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Mot de passe *</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Rôle</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                >
                  <option value="responsable">Responsable</option>
                  <option value="employe">Employé</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Code PIN (4-6 chiffres) *</label>
                <input
                  type="password"
                  value={form.pin_code}
                  onChange={(e) => setForm({ ...form, pin_code: e.target.value })}
                  maxLength={6}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-stone-700 mb-1">Confirmer PIN *</label>
                <input
                  type="password"
                  value={form.pin_confirm}
                  onChange={(e) => setForm({ ...form, pin_confirm: e.target.value })}
                  maxLength={6}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </div>
            </div>

            {/* Permissions à la création */}
            <div className="border border-stone-200 rounded-xl p-4 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <Shield size={16} className="text-yellow-600" />
                <h3 className="text-sm font-semibold text-stone-700">
                  Permissions ({selectedPermissions.length} sélectionnées)
                </h3>
              </div>
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {Object.entries(groupedPermissions).map(([module, perms]) => {
                  const allSelected = perms.every(p => selectedPermissions.includes(p.code))
                  return (
                    <div key={module}>
                      <div className="flex items-center gap-2 mb-1">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={() => toggleModule(module, selectedPermissions, setSelectedPermissions)}
                          className="accent-yellow-600"
                        />
                        <span className="text-xs font-semibold text-stone-600 uppercase">
                          {module} ({perms.filter(p => selectedPermissions.includes(p.code)).length}/{perms.length})
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-1 pl-4">
                        {perms.map((perm) => (
                          <label key={perm.code} className="flex items-center gap-1.5 text-xs text-stone-600 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedPermissions.includes(perm.code)}
                              onChange={() => togglePermission(perm.code, selectedPermissions, setSelectedPermissions)}
                              className="accent-yellow-600"
                            />
                            {perm.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

            <div className="flex gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {saving ? 'Création...' : 'Créer l\'employé'}
              </button>
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-stone-600 hover:bg-stone-100 rounded-lg text-sm">
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal modifier employé */}
      {showEditModal && editingEmployee && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl smrounded-2xl p-5 w-full sm:max-w-md shadow-xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-stone-800">Modifier l'employé</h2>
              <button onClick={() => setShowEditModal(false)}>
                <X size={18} className="text-stone-400" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Nom complet</label>
                <input
                  value={editForm.full_name}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Téléphone</label>
                <input
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </div>
              {editingEmployee.role !== 'admin' && (
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Rôle</label>
                  <select
                    value={editForm.role}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                    className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  >
                    <option value="responsable">Responsable</option>
                    <option value="employe">Employé</option>
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Nouveau code PIN (vide = pas de changement)
                </label>
                <input
                  type="password"
                  value={editForm.pin_code}
                  onChange={(e) => setEditForm({ ...editForm, pin_code: e.target.value })}
                  maxLength={6}
                  placeholder="Nouveau PIN..."
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={handleEdit}
                disabled={saving}
                className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
              <button onClick={() => setShowEditModal(false)} className="px-4 py-2 text-stone-600 hover:bg-stone-100 rounded-lg text-sm">
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal permissions */}
      {showPermModal && editingEmployee && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl p-5 w-full sm:max-w-2xl shadow-xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-stone-800">
                  Permissions — {editingEmployee.full_name}
                </h2>
                <p className="text-xs text-stone-400">{editPermissions.length} permissions accordées</p>
              </div>
              <button onClick={() => setShowPermModal(false)}>
                <X size={18} className="text-stone-400" />
              </button>
            </div>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto mb-4">
              {Object.entries(groupedPermissions).map(([module, perms]) => {
                const allSelected = perms.every(p => editPermissions.includes(p.code))
                const someSelected = perms.some(p => editPermissions.includes(p.code))
                return (
                  <div key={module} className="border border-stone-100 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={() => toggleModule(module, editPermissions, setEditPermissions)}
                        className="accent-yellow-600"
                      />
                      <span className="text-sm font-semibold text-stone-700 uppercase">
                        {module}
                      </span>
                      <span className="text-xs text-stone-400 ml-auto">
                        {perms.filter(p => editPermissions.includes(p.code)).length}/{perms.length}
                      </span>
                      <button
                        onClick={() => toggleModule(module, editPermissions, setEditPermissions)}
                        className="text-xs text-yellow-600 hover:text-yellow-700"
                      >
                        {allSelected ? 'Tout retirer' : 'Tout sélectionner'}
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 pl-4">
                      {perms.map((perm) => (
                        <label key={perm.code} className="flex items-center gap-2 text-xs text-stone-600 cursor-pointer hover:text-stone-800">
                          <input
                            type="checkbox"
                            checked={editPermissions.includes(perm.code)}
                            onChange={() => togglePermission(perm.code, editPermissions, setEditPermissions)}
                            className="accent-yellow-600"
                          />
                          {perm.label}
                        </label>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleSavePermissions}
                disabled={saving}
                className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {saving ? 'Enregistrement...' : 'Enregistrer les permissions'}
              </button>
              <button onClick={() => setShowPermModal(false)} className="px-4 py-2 text-stone-600 hover:bg-stone-100 rounded-lg text-sm">
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}