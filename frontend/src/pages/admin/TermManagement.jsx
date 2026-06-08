import { useState, useEffect } from 'react';
import API from '../../api/client';
import toast from 'react-hot-toast';

export default function TermManagement() {
  const [terms, setTerms] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const initialForm = { year: new Date().getFullYear(), term_number: 1, status: 'active' };
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);

  const load = () => API.get('/terms').then(res => setTerms(res.data));

  useEffect(() => { load(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await API.post('/terms', {
        ...form,
        year: Number(form.year),
        term_number: Number(form.term_number),
        label: null,
      });
      toast.success('Term created!');
      setShowModal(false);
      setForm(initialForm);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed.');
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (id, status) => {
    try {
      await API.put(`/terms/${id}`, { status });
      toast.success(`Term status updated to ${status}`);
      load();
    } catch (err) {
      toast.error('Failed to update status.');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title"> Term Management</h1>
          <p className="page-subtitle">Create and manage academic terms (3 per year).</p>
        </div>
        <button id="create-term-btn" className="btn btn-primary" onClick={() => setShowModal(true)}> New Term</button>
      </div>

      <div className="card">
        {terms.length === 0 ? (
          <div className="empty-state"><div className="empty-state-icon"></div><h3>No terms yet</h3></div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>Term</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {terms.map(t => (
                  <tr key={t.id}>
                    <td><strong>Term {t.term_number}</strong></td>
                    <td>
                      <span className={`badge ${t.status === 'active' ? 'badge-green' : t.status === 'upcoming' ? 'badge-blue' : 'badge-red'}`}>
                        {t.status}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-8">
                        {t.status !== 'active' && (
                          <button className="btn btn-success btn-sm" onClick={() => updateStatus(t.id, 'active')}>Activate</button>
                        )}
                        {t.status === 'active' && (
                          <button className="btn btn-secondary btn-sm" onClick={() => updateStatus(t.id, 'completed')}>Mark Complete</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 1, paddingBottom: 16, marginBottom: 0 }}>
              <h2 className="modal-title">Create New Term</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Year</label>
                  <input id="term-year" type="number" className="form-input" value={form.year} onChange={e => setForm(f => ({ ...f, year: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Term Number</label>
                  <select id="term-number" className="form-select" value={form.term_number} onChange={e => setForm(f => ({ ...f, term_number: e.target.value }))}>
                    <option value={1}>Term 1</option>
                    <option value={2}>Term 2</option>
                    <option value={3}>Term 3</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select id="term-status" className="form-select" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  <option value="active">Active</option>
                  <option value="upcoming">Upcoming</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              <button id="submit-term" type="submit" className="btn btn-primary w-full" disabled={saving}>
                {saving ? 'Creating...' : 'Create Term'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
