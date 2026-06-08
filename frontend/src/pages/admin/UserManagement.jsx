import { useState, useEffect } from 'react';
import API from '../../api/client';
import toast from 'react-hot-toast';

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [roleFilter, setRoleFilter] = useState('student');
  const [programFilter, setProgramFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'student', is_active: true, cqpi: '', student_id: '', department: '', enrollment_year: '', program_id: '' });
  const [saving, setSaving] = useState(false);
  const activePrograms = programs.filter(p => p.is_active);

  const load = () => {
    const params = new URLSearchParams({ role: roleFilter });
    if (roleFilter === 'faculty' && programFilter) params.set('programId', programFilter);
    return API.get(`/users?${params.toString()}`).then(res => setUsers(res.data));
  };
  useEffect(() => { load(); }, [roleFilter, programFilter]);
  useEffect(() => { API.get('/programs').then(res => setPrograms(res.data)); }, []);

  // Reset program filter when switching to admins
  useEffect(() => { if (roleFilter === 'admin') setProgramFilter(''); }, [roleFilter]);

  const openCreate = () => {
    setEditUser(null);
    setForm({ name: '', email: '', password: '', role: roleFilter, cqpi: '', student_id: '', department: '', enrollment_year: '', program_id: roleFilter === 'student' ? (programFilter || '') : '' });
    setShowModal(true);
  };

  const openEdit = (u) => {
    setEditUser(u);
    setForm({ name: u.name, email: u.email, password: '', role: u.role, is_active: u.is_active, cqpi: u.cqpi || '', student_id: u.student_id || '', department: u.department || '', enrollment_year: u.enrollment_year || '', program_id: u.program_id || '' });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, cqpi: form.cqpi ? Number(form.cqpi) : undefined, enrollment_year: form.enrollment_year ? Number(form.enrollment_year) : undefined, program_id: form.role === 'student' ? (form.program_id || null) : null };
      if (!payload.password) delete payload.password;
      // Always include is_active when editing
      if (!editUser) delete payload.is_active;

      if (editUser) {
        await API.put(`/users/${editUser.id}`, payload);
        toast.success('User updated.');
      } else {
        await API.post('/users', payload);
        toast.success('User created.');
      }
      setShowModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed.');
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async (id) => {
    if (!confirm('Deactivate this user?')) return;
    try {
      await API.delete(`/users/${id}`);
      toast.success('User deactivated.');
      load();
    } catch (err) {
      toast.error('Failed.');
    }
  };

  const activate = async (id) => {
    if (!confirm('Reactivate this user?')) return;
    try {
      await API.put(`/users/${id}`, { is_active: true });
      toast.success('User activated.');
      load();
    } catch (err) {
      toast.error('Failed.');
    }
  };

  // Apply search + program filter
  const filtered = users.filter(u => {
    const matchSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.student_id && u.student_id.includes(search));
    const matchProgram = roleFilter === 'faculty' || !programFilter || u.program_id === programFilter;
    return matchSearch && matchProgram;
  });

  // Count students per program for display in dropdown
  const programCounts = programs.reduce((acc, p) => {
    acc[p.id] = users.filter(u => u.program_id === p.id).length;
    return acc;
  }, {});

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title"> User Management</h1>
          <p className="page-subtitle">Add, edit, and manage students and faculty accounts.</p>
        </div>
        <button id="create-user-btn" className="btn btn-primary" onClick={openCreate}> Add User</button>
      </div>

      <div className="card mb-24">
        <div className="flex items-center gap-16" style={{ flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <input id="user-search" type="text" className="form-input" placeholder=" Search by name, email, or ID..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-8">
            {['student', 'faculty', 'admin'].map(r => (
              <button key={r} id={`filter-${r}`} className={`btn ${roleFilter === r ? 'btn-primary' : 'btn-ghost'} btn-sm`} onClick={() => setRoleFilter(r)}>
                {r === 'student' ? '🎓' : r === 'faculty' ? '👨‍🏫' : '🛡'} {r.charAt(0).toUpperCase() + r.slice(1)}s
              </button>
            ))}
          </div>
          {['student', 'faculty'].includes(roleFilter) && programs.length > 0 && (
            <select
              id="user-program-filter"
              className="form-select"
              value={programFilter}
              onChange={e => setProgramFilter(e.target.value)}
              style={{ minWidth: 180 }}
            >
              <option value="">{roleFilter === 'faculty' ? 'All Programs' : `All Programs (${users.length})`}</option>
              {programs.map(p => (
                <option key={p.id} value={p.id}>
                  {roleFilter === 'faculty' ? p.name : `${p.name} (${programCounts[p.id] || 0})`}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="card">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                {roleFilter === 'student' && <><th>Student ID</th><th>CQPI</th><th>Program</th><th>Enroll Year</th></>}
                {roleFilter === 'faculty' && <th>Department</th>}
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id}>
                  <td><strong>{u.name}</strong></td>
                  <td className="text-muted">{u.email}</td>
                  {roleFilter === 'student' && <>
                    <td className="text-muted">{u.student_id || '-'}</td>
                    <td><span className="badge badge-blue">{u.cqpi || '-'}</span></td>
                    <td className="text-muted">{u.program?.name || '-'}</td>
                    <td className="text-muted">{u.enrollment_year || '-'}</td>
                  </>}
                  {roleFilter === 'faculty' && <td className="text-muted">{u.department || '-'}</td>}
                  <td>
                    <span className={`badge ${u.is_active ? 'badge-green' : 'badge-red'}`}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-8">
                      <button id={`edit-user-${u.id}`} className="btn btn-secondary btn-sm" onClick={() => openEdit(u)}> Edit</button>
                      {u.is_active
                        ? <button id={`deactivate-user-${u.id}`} className="btn btn-danger btn-sm" onClick={() => deactivate(u.id)}>Deactivate</button>
                        : <button id={`activate-user-${u.id}`} className="btn btn-success btn-sm" onClick={() => activate(u.id)}>Activate</button>
                      }
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan="8"><div className="empty-state" style={{ padding: '32px' }}><div className="empty-state-icon"></div><h3>No users found</h3></div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 580 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 1, paddingBottom: 16, marginBottom: 0 }}>
              <h2 className="modal-title">{editUser ? 'Edit User' : 'Create User'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input id="user-name" className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Role</label>
                  <select id="user-role" className="form-select" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} disabled={!!editUser}>
                    <option value="student">Student</option>
                    <option value="faculty">Faculty</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Email *</label>
                <input id="user-email" type="email" className="form-input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required disabled={!!editUser} />
              </div>
              <div className="form-group">
                <label className="form-label">{editUser ? 'New Password (leave blank to keep)' : 'Password *'}</label>
                <input id="user-password" type="password" className="form-input" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required={!editUser} />
              </div>
              {form.role === 'student' && (
                <div className="form-group">
                  <label className="form-label">Program *</label>
                  <select className="form-select" value={form.program_id} onChange={e => setForm(f => ({ ...f, program_id: e.target.value }))} required>
                    <option value="">Select program</option>
                    {activePrograms.map(p => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
                  </select>
                </div>
              )}
              {form.role === 'student' && (
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Student ID</label>
                    <input id="user-student-id" className="form-input" value={form.student_id} onChange={e => setForm(f => ({ ...f, student_id: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">CQPI</label>
                    <input id="user-cqpi" type="number" min="0" max="10" step="0.01" className="form-input" value={form.cqpi} onChange={e => setForm(f => ({ ...f, cqpi: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Enrollment Year</label>
                    <input id="user-year" type="number" className="form-input" value={form.enrollment_year} onChange={e => setForm(f => ({ ...f, enrollment_year: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Department</label>
                    <input id="user-dept" className="form-input" value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} />
                  </div>
                </div>
              )}
              {form.role === 'faculty' && (
                <div className="form-group">
                  <label className="form-label">Department</label>
                  <input id="user-faculty-dept" className="form-input" value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} />
                </div>
              )}
              {editUser && (
                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                    <input
                      id="user-is-active"
                      type="checkbox"
                      checked={form.is_active}
                      onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                    />
                    <span className="form-label" style={{ margin: 0 }}>
                      Account Active
                      {!form.is_active && <span className="badge badge-red" style={{ marginLeft: 8, fontSize: 10 }}>Currently Inactive</span>}
                      {form.is_active && <span className="badge badge-green" style={{ marginLeft: 8, fontSize: 10 }}>Currently Active</span>}
                    </span>
                  </label>
                </div>
              )}
              <button id="submit-user" type="submit" className="btn btn-primary w-full" disabled={saving}>
                {saving ? 'Saving...' : editUser ? 'Update User' : 'Create User'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
