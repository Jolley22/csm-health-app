import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { Plus, X, UserCheck, UserX } from 'lucide-react';

const CSM_NAMES = ['Brooke', 'Natalie', 'Ryan', 'Jasmin', 'Jake', 'Jessica', 'Cody', 'Emmalyn'];

export default function UserManagement({ currentUserId }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    email: '', password: '', role: 'csm', csm_name: '', full_name: ''
  });
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error) setUsers(data || []);
    setLoading(false);
  };

  useEffect(() => { loadUsers(); }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
      // Clear csm_name when switching to admin role
      ...(name === 'role' && value === 'admin' ? { csm_name: '' } : {})
    }));
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (formData.role === 'csm' && !formData.csm_name) {
      setFormError('CSM Name is required for CSM users.');
      return;
    }

    setSaving(true);
    try {
      // Create auth user — requires email confirmation ON in Supabase so admin session is preserved
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('User creation failed: no user returned.');

      // Insert profile row
      const { error: profileError } = await supabase
        .from('user_profiles')
        .insert({
          id: authData.user.id,
          email: formData.email,
          role: formData.role,
          csm_name: formData.role === 'csm' ? formData.csm_name : null,
          full_name: formData.full_name || null,
          is_active: true,
        });

      if (profileError) throw profileError;

      setFormSuccess(`User "${formData.email}" created successfully. They will receive a confirmation email to activate their account.`);
      setFormData({ email: '', password: '', role: 'csm', csm_name: '', full_name: '' });
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

  const roleBadge = (role) => (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
      role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
    }`}>
      {role === 'admin' ? 'Admin' : 'CSM'}
    </span>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">User Management</h2>
          <p className="text-sm text-gray-500 mt-1">Create and manage user accounts and roles.</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setFormError(''); setFormSuccess(''); }}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name <span className="text-gray-400">(optional)</span></label>
                <input
                  type="text"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleInputChange}
                  placeholder="e.g. Brooke Smith"
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Temporary Password *</label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                  minLength={8}
                  placeholder="Min. 8 characters"
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
              {formData.role === 'csm' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CSM Name *</label>
                  <select
                    name="csm_name"
                    value={formData.csm_name}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    <option value="">Select CSM name</option>
                    {CSM_NAMES.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Must match the CSM name assigned to customers.</p>
                </div>
              )}
            </div>

            {formError && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
                {formError}
              </div>
            )}

            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => { setShowForm(false); setFormError(''); }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
              >
                {saving ? 'Creating...' : 'Create User'}
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
                <th className="text-left px-4 py-3 font-medium text-gray-600">CSM Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map(user => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-900">{user.full_name || <span className="text-gray-400">—</span>}</td>
                  <td className="px-4 py-3 text-gray-700">{user.email}</td>
                  <td className="px-4 py-3">{roleBadge(user.role)}</td>
                  <td className="px-4 py-3 text-gray-700">{user.csm_name || <span className="text-gray-400">—</span>}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      user.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {user.id !== currentUserId && (
                      <button
                        onClick={() => handleToggleActive(user)}
                        className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-medium border transition-colors ${
                          user.is_active
                            ? 'border-red-200 text-red-600 hover:bg-red-50'
                            : 'border-green-200 text-green-600 hover:bg-green-50'
                        }`}
                      >
                        {user.is_active ? (
                          <><UserX className="w-3 h-3" /> Deactivate</>
                        ) : (
                          <><UserCheck className="w-3 h-3" /> Activate</>
                        )}
                      </button>
                    )}
                    {user.id === currentUserId && (
                      <span className="text-xs text-gray-400">You</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
