import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { Plus, X, UserCheck, UserX, Pencil, Trash2 } from 'lucide-react';

export default function UserManagement({ currentUserId }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({ email: '', role: 'csm', full_name: '' });
  const [editData, setEditData] = useState({ email: '', role: 'csm', full_name: '' });
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [editError, setEditError] = useState('');
  const [saving, setSaving] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    const [{ data: profiles }, { data: pending }] = await Promise.all([
      supabase.from('user_profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('pending_users').select('*').order('created_at', { ascending: false }),
    ]);
    const active = (profiles || []).map(u => ({ ...u, isPending: false }));
    const pendingMapped = (pending || []).map(u => ({ ...u, isPending: true, is_active: u.is_active ?? true }));
    setUsers([...active, ...pendingMapped]);
    setLoading(false);
  };

  useEffect(() => { loadUsers(); }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleEditInputChange = (e) => {
    const { name, value } = e.target;
    setEditData(prev => ({ ...prev, [name]: value }));
  };

  const startEditing = (user) => {
    setEditingUser(user);
    setEditData({ email: user.email, role: user.role, full_name: user.full_name || '' });
    setEditError('');
  };

  const cancelEditing = () => { setEditingUser(null); setEditError(''); };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setEditError('');
    if (editData.role === 'csm' && !editData.full_name) {
      setEditError('Full Name is required for CSM users.');
      return;
    }
    setEditSaving(true);
    try {
      const table = editingUser.isPending ? 'pending_users' : 'user_profiles';
      const filter = editingUser.isPending ? { column: 'email', value: editingUser.email } : { column: 'id', value: editingUser.id };
      const { error } = await supabase
        .from(table)
        .update({
          email: editData.email,
          role: editData.role,
          csm_name: editData.role === 'csm' ? editData.full_name : null,
          full_name: editData.full_name || null,
        })
        .eq(filter.column, filter.value);
      if (error) throw error;
      setEditingUser(null);
      setFormSuccess(`User "${editData.email}" updated successfully.`);
      await loadUsers();
    } catch (err) {
      setEditError(err.message);
    } finally {
      setEditSaving(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');
    if (formData.role === 'csm' && !formData.full_name) {
      setFormError('Full Name is required for CSM users.');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('pending_users').insert({
        email: formData.email,
        role: formData.role,
        csm_name: formData.role === 'csm' ? formData.full_name : null,
        full_name: formData.full_name || null,
        is_active: true,
      });
      if (error) {
        if (error.code === '23505') {
          setFormError('A user with this email already exists.');
        } else {
          throw error;
        }
        return;
      }
      setFormSuccess(`"${formData.email}" registered. They will get access when they sign in with Google.`);
      setFormData({ email: '', role: 'csm', full_name: '' });
      setShowForm(false);
      await loadUsers();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (user) => {
    const { error } = await supabase
      .from('user_profiles')
      .update({ is_active: !user.is_active })
      .eq('id', user.id);
    if (!error) await loadUsers();
  };

  const handleDeletePending = async (user) => {
    const { error } = await supabase.from('pending_users').delete().eq('email', user.email);
    if (!error) await loadUsers();
  };

  const roleBadge = (role) => (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
      role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
    }`}>
      {role === 'admin' ? 'Admin' : 'CSM'}
    </span>
  );

  const rowKey = (user) => user.isPending ? `pending-${user.email}` : user.id;
  const editKey = (user) => user.isPending ? `pending-${user.email}` : user.id;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">User Management</h2>
          <p className="text-sm text-gray-500 mt-1">Create and manage user accounts and roles.</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setFormError(''); setFormSuccess(''); setEditingUser(null); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Add User
        </button>
      </div>

      {formSuccess && (
        <div className="flex items-start justify-between gap-3 bg-green-50 border border-green-200 text-green-800 rounded-lg px-4 py-3 text-sm">
          <span>{formSuccess}</span>
          <button onClick={() => setFormSuccess('')} className="text-green-600 hover:text-green-800 flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">New User</h3>
            <button onClick={() => { setShowForm(false); setFormError(''); }} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name {formData.role === 'csm' && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="text"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleInputChange}
                  placeholder="e.g. Brooke Taylor"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  placeholder="user@example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="csm">CSM</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            {formError && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{formError}</div>
            )}
            <div className="flex gap-2 justify-end pt-2">
              <button type="button" onClick={() => { setShowForm(false); setFormError(''); }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm">
                Cancel
              </button>
              <button type="submit" disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50">
                {saving ? 'Saving...' : 'Add User'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500 text-sm">Loading users...</div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">No users found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Role</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map(user => (
                <React.Fragment key={rowKey(user)}>
                  <tr className={`hover:bg-gray-50 ${editKey(editingUser) === editKey(user) ? 'bg-blue-50' : ''}`}>
                    <td className="px-4 py-3 text-gray-900">{user.full_name || <span className="text-gray-400">—</span>}</td>
                    <td className="px-4 py-3 text-gray-700">{user.email}</td>
                    <td className="px-4 py-3">{roleBadge(user.role)}</td>
                    <td className="px-4 py-3">
                      {user.isPending ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                          Pending Sign-in
                        </span>
                      ) : (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          user.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {editKey(editingUser) === editKey(user) ? (
                          <button onClick={cancelEditing}
                            className="flex items-center gap-1 px-3 py-1 rounded text-xs font-medium border border-gray-200 text-gray-500 hover:bg-gray-50">
                            <X className="w-3 h-3" /> Cancel
                          </button>
                        ) : (
                          <button onClick={() => { startEditing(user); setShowForm(false); }}
                            className="flex items-center gap-1 px-3 py-1 rounded text-xs font-medium border border-blue-200 text-blue-600 hover:bg-blue-50">
                            <Pencil className="w-3 h-3" /> Edit
                          </button>
                        )}
                        {user.isPending ? (
                          <button onClick={() => handleDeletePending(user)}
                            className="flex items-center gap-1 px-3 py-1 rounded text-xs font-medium border border-red-200 text-red-600 hover:bg-red-50">
                            <Trash2 className="w-3 h-3" /> Remove
                          </button>
                        ) : user.id !== currentUserId ? (
                          <button onClick={() => handleToggleActive(user)}
                            className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-medium border transition-colors ${
                              user.is_active ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-green-200 text-green-600 hover:bg-green-50'
                            }`}>
                            {user.is_active ? <><UserX className="w-3 h-3" /> Deactivate</> : <><UserCheck className="w-3 h-3" /> Activate</>}
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">You</span>
                        )}
                      </div>
                    </td>
                  </tr>

                  {editKey(editingUser) === editKey(user) && (
                    <tr className="bg-blue-50 border-b border-blue-100">
                      <td colSpan={5} className="px-4 py-4">
                        <form onSubmit={handleSaveEdit} className="space-y-3">
                          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2">Editing {user.email}</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Full Name</label>
                              <input type="text" name="full_name" value={editData.full_name} onChange={handleEditInputChange}
                                placeholder="Full name"
                                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm" />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                              <input type="email" name="email" value={editData.email} onChange={handleEditInputChange} required
                                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm" />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Role</label>
                              <select name="role" value={editData.role} onChange={handleEditInputChange}
                                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm">
                                <option value="csm">CSM</option>
                                <option value="admin">Admin</option>
                              </select>
                            </div>
                          </div>
                          {editError && (
                            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">{editError}</div>
                          )}
                          <div className="flex gap-2 justify-end">
                            <button type="button" onClick={cancelEditing}
                              className="px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm">Cancel</button>
                            <button type="submit" disabled={editSaving}
                              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50">
                              {editSaving ? 'Saving...' : 'Save Changes'}
                            </button>
                          </div>
                        </form>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
