import { useState, useEffect } from 'react';
import API from '../../api/client';
import toast from 'react-hot-toast';

export default function ProgramManagement() {
  const [programs, setPrograms] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editProgram, setEditProgram] = useState(null);
  const [form, setForm] = useState({ name: '', code: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null); // program to confirm delete
  const [deleting, setDeleting] = useState(false);

  const load = () => API.get('/programs').then(res => setPrograms(res.data));
  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditProgram(null);
    setForm({ name: '', code: '', description: '' });
    setShowModal(true);
  };

  const openEdit = (p) => {
    setEditProgram(p);
    setForm({ name: p.name, code: p.code, description: p.description || '' });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editProgram) {
        await API.put(`/programs/${editProgram.id}`, form);
        toast.success('Program updated.');
      } else {
        await API.post('/programs', form);
        toast.success('Program created.');
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
    if (!confirm('Deactivate this program? Students can no longer see it.')) return;
    try {
      await API.put(`/programs/${id}`, { is_active: false });
      toast.success('Program deactivated.');
      load();
    } catch (err) {
      toast.error('Failed.');
    }
  };

  const reactivate = async (id) => {
    try {
      await API.put(`/programs/${id}`, { is_active: true });
      toast.success('Program reactivated.');
      load();
    } catch (err) {
      toast.error('Failed.');
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await API.delete(`/programs/${deleteTarget.id}`);
      toast.success('Program permanently deleted.');
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete program.');
    } finally {
      setDeleting(false);
    }
  };

  const filtered = programs.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Program Management</h1>
          <p className="page-subtitle">Manage XLRI MBA programs. Associate courses and students with programs.</p>
        </div>
        <button id="create-program-btn" className="btn btn-primary" onClick={openCreate}>
          + New Program
        </button>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-icon blue"></div>
          <div>
            <div className="stat-value">{programs.length}</div>
            <div className="stat-label">Total Programs</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"></div>
          <div>
            <div className="stat-value">{programs.filter(p => p.is_active).length}</div>
            <div className="stat-label">Active Programs</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon red"></div>
          <div>
            <div className="stat-value">{programs.filter(p => !p.is_active).length}</div>
            <div className="stat-label">Inactive Programs</div>
          </div>
        </div>
      </div>

      <div className="card mb-24">
        <input
          type="text"
          className="form-input"
          placeholder="Search programs..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Programs Grid */}
      <div className="courses-grid">
        {filtered.map(program => (
          <div key={program.id} className={`course-card ${!program.is_active ? 'cancelled' : ''}`}>
            <div className="flex justify-between items-center mb-8">
              <div className="course-code">{program.code}</div>
              <span className={`badge ${program.is_active ? 'badge-green' : 'badge-red'}`}>
                {program.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="course-name">{program.name}</div>
            {program.description && (
              <p className="text-muted text-sm" style={{ marginTop: 8, lineHeight: 1.5 }}>
                {program.description}
              </p>
            )}
            <div className="flex gap-8" style={{ marginTop: 16, flexWrap: 'wrap' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => openEdit(program)}
              >Edit</button>
              {program.is_active ? (
                <button
                  className="btn btn-warning btn-sm"
                  onClick={() => deactivate(program.id)}
                  style={{ background: 'var(--warning, #f59e0b)', color: '#fff', border: 'none' }}
                >Deactivate</button>
              ) : (
                <button
                  className="btn btn-success btn-sm"
                  onClick={() => reactivate(program.id)}
                >Reactivate</button>
              )}
              <button
                className="btn btn-danger btn-sm"
                onClick={() => setDeleteTarget(program)}
              >Delete</button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="empty-state" style={{ gridColumn: '1/-1' }}>
            <div className="empty-state-icon"></div>
            <h3>No programs found</h3>
            <p>Click "New Program" to add an MBA program.</p>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 1, paddingBottom: 16, marginBottom: 0 }}>
              <h2 className="modal-title">{editProgram ? 'Edit Program' : 'Create Program'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Program Name *</label>
                  <input
                    id="program-name"
                    className="form-input"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. MBA (Human Resources)"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Program Code *</label>
                  <input
                    id="program-code"
                    className="form-input"
                    value={form.code}
                    onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                    placeholder="e.g. MBA-HR"
                    required
                    disabled={!!editProgram}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  className="form-textarea"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Brief description of the program..."
                />
              </div>
              <button
                id="submit-program"
                type="submit"
                className="btn btn-primary w-full"
                disabled={saving}
              >
                {saving ? 'Saving...' : editProgram ? 'Update Program' : 'Create Program'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => !deleting && setDeleteTarget(null)}>
          <div className="modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 16, marginBottom: 20 }}>
              <h2 className="modal-title" style={{ color: 'var(--danger, #ef4444)' }}>⚠ Delete Program</h2>
              <button className="modal-close" onClick={() => setDeleteTarget(null)} disabled={deleting}>✕</button>
            </div>
            <div style={{ marginBottom: 24 }}>
              <p style={{ marginBottom: 12 }}>
                You are about to <strong>permanently delete</strong> the program:
              </p>
              <div style={{
                background: 'var(--bg-secondary, #f8fafc)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '12px 16px',
                marginBottom: 12,
              }}>
                <div className="course-code" style={{ marginBottom: 4 }}>{deleteTarget.code}</div>
                <div className="course-name">{deleteTarget.name}</div>
              </div>
              <p className="text-muted text-sm">
                This action <strong>cannot be undone</strong>. The program will be permanently removed from the system.
                Any students currently enrolled in this program will have their program assignment <strong>reset to none</strong>.
                Deletion will be blocked if courses are still linked to this program.
              </p>
            </div>
            <div className="flex gap-8" style={{ justifyContent: 'flex-end' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >Cancel</button>
              <button
                id="confirm-delete-program"
                className="btn btn-danger"
                onClick={confirmDelete}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Yes, Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
