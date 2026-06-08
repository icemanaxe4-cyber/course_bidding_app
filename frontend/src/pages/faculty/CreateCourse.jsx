import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../../api/client';
import toast from 'react-hot-toast';

const formatTerm = (term) => term ? `Term ${term.term_number}` : '-';

export default function CreateCourse() {
  const navigate = useNavigate();
  const [terms, setTerms] = useState([]);
  const [termsLoading, setTermsLoading] = useState(true);
  const [termsError, setTermsError] = useState('');
  const [form, setForm] = useState({
    code: '', name: '', description: '', credits: 3,
    term_id: '', cqpi_cutoff: 0, min_strength: 15, max_strength: 120,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    API.get('/terms')
      .then(res => {
        const availableTerms = res.data.filter(t => t.status !== 'completed');
        setTerms(availableTerms);
        const active = availableTerms.find(t => t.status === 'active');
        const fallback = availableTerms[0];
        if (active || fallback) setForm(f => ({ ...f, term_id: (active || fallback).id }));
        setTermsError('');
      })
      .catch(err => {
        const message = err.response?.data?.error || 'Unable to load terms. Please ask an admin to create an active term.';
        setTermsError(message);
        toast.error(message);
      })
      .finally(() => setTermsLoading(false));
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.term_id) { toast.error('Please select a term.'); return; }
    if (Number(form.max_strength) < Number(form.min_strength)) {
      toast.error('Maximum seats must be greater than or equal to minimum seats.');
      return;
    }
    setSaving(true);
    try {
      const res = await API.post('/courses', {
        ...form,
        credits: Number(form.credits),
        cqpi_cutoff: Number(form.cqpi_cutoff),
        min_strength: Number(form.min_strength),
        max_strength: Number(form.max_strength),
      });
      toast.success('Course created successfully!');
      navigate(`/faculty/course/${res.data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create course.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title"> Float New Course</h1>
          <p className="page-subtitle">Create a course for students to bid on. Min 15, max 120 seats.</p>
        </div>
        <button className="btn btn-ghost" onClick={() => navigate('/faculty/dashboard')}> Back</button>
      </div>

      <div className="card" style={{ maxWidth: 640 }}>
        <form onSubmit={handleSubmit}>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Course Code *</label>
              <input id="course-code" name="code" className="form-input" placeholder="e.g. CS601" value={form.code} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label className="form-label">Credits *</label>
              <select id="course-credits" name="credits" className="form-select" value={form.credits} onChange={handleChange}>
                {[1,2,3,4,5].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Course Name *</label>
            <input id="course-name" name="name" className="form-input" placeholder="e.g. Deep Learning" value={form.name} onChange={handleChange} required />
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea id="course-desc" name="description" className="form-textarea" placeholder="Brief description of the course..." value={form.description} onChange={handleChange} />
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Term *</label>
              <select
                id="course-term"
                name="term_id"
                className="form-select"
                value={form.term_id}
                onChange={handleChange}
                required
                disabled={termsLoading || terms.length === 0}
              >
                <option value="">
                  {termsLoading ? 'Loading terms...' : terms.length === 0 ? 'No open terms available' : 'Select term'}
                </option>
                {terms.map(t => (
                  <option key={t.id} value={t.id}>
                    {formatTerm(t)} ({t.status})
                  </option>
                ))}
              </select>
              {termsError && <p className="form-error">{termsError}</p>}
              {!termsLoading && !termsError && terms.length === 0 && (
                <p className="form-error">No upcoming or active terms are available. Ask an admin to create or activate a term.</p>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">Minimum CQPI Cutoff</label>
              <input
                id="course-cqpi"
                name="cqpi_cutoff"
                type="number"
                min="0" max="10" step="0.1"
                className="form-input"
                value={form.cqpi_cutoff}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Minimum Seats</label>
              <input
                id="course-min-strength"
                name="min_strength"
                type="number"
                min="1"
                className="form-input"
                value={form.min_strength}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Maximum Seats</label>
              <input
                id="course-max-strength"
                name="max_strength"
                type="number"
                min={form.min_strength || 1}
                className="form-input"
                value={form.max_strength}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="card-glass" style={{ marginBottom: 20, padding: 16 }}>
            <p className="text-muted text-sm">
              If fewer than the minimum seats are allocated after a round, the course may be automatically cancelled.
            </p>
          </div>

          <button id="submit-course" type="submit" className="btn btn-primary btn-lg w-full" disabled={saving}>
            {saving ? <><span className="spin"></span> Creating...</> : ' Float Course'}
          </button>
        </form>
      </div>
    </div>
  );
}
