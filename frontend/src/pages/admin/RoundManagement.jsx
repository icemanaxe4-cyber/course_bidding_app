import { useState, useEffect } from 'react';
import API from '../../api/client';
import toast from 'react-hot-toast';

import { formatTerm } from '../../utils/termUtils';

export default function RoundManagement() {
  const [programs, setPrograms] = useState([]);
  const [selectedProgram, setSelectedProgram] = useState('');
  const [rounds, setRounds] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [processing, setProcessing] = useState(null);
  const [courses, setCourses] = useState([]);
  const [form, setForm] = useState({
    round_number: 1,
    opens_at: '',
    closes_at: '',
    notes: '',
    covers_all_terms: true,
    program_ids: [],
  });

  useEffect(() => {
    API.get('/programs').then(pRes => {
      const activePrograms = pRes.data.filter(p => p.is_active);
      setPrograms(activePrograms);
    });
  }, []);

  const loadRounds = (programId) => {
    const query = programId ? `?programId=${programId}` : '';
    API.get(`/rounds${query}`).then(res => setRounds(res.data));
  };

  const loadCourses = (programId) => {
    const query = programId ? `?programId=${programId}` : '';
    API.get(`/courses${query}`).then(res => setCourses(res.data));
  };

  useEffect(() => {
    loadRounds(selectedProgram);
    loadCourses(selectedProgram);
  }, [selectedProgram]);

  const createRound = async (e) => {
    e.preventDefault();
    if (form.program_ids.length === 0) {
      toast.error('Select at least one program.');
      return;
    }
    try {
      const res = await API.post('/rounds', {
        program_ids: form.program_ids,
        round_number: Number(form.round_number),
        opens_at: form.opens_at,
        closes_at: form.closes_at,
        notes: form.notes,
        covers_all_terms: true,
      });
      const createdCount = Array.isArray(res.data) ? res.data.length : 1;
      toast.success(`${createdCount} round${createdCount === 1 ? '' : 's'} created!`);
      setShowModal(false);
      if (selectedProgram) loadRounds(selectedProgram);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed.');
    }
  };

  const forceClose = async (id) => {
    if (!confirm('End and process this round? This will close bidding and publish allocation results.')) return;
    setProcessing(id);
    try {
      const res = await API.post(`/rounds/${id}/process`);
      toast.success(
        `Round processed! ${res.data.allocations_created} allocations across ${res.data.terms_processed || 1} term(s). ${res.data.courses_cancelled} courses cancelled.`
      );
      loadRounds(selectedProgram);
      loadCourses(selectedProgram);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Processing failed.');
    } finally {
      setProcessing(null);
    }
  };

  const processRound = async (id) => {
    if (!confirm('Process this round? This will run the allocation algorithm for all selected courses.')) return;
    setProcessing(id);
    try {
      const res = await API.post(`/rounds/${id}/process`);
      toast.success(
        `Round processed! ${res.data.allocations_created} allocations across ${res.data.terms_processed || 1} term(s). ${res.data.courses_cancelled} courses cancelled.`
      );
      loadRounds(selectedProgram);
      loadCourses(selectedProgram);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Processing failed.');
    } finally {
      setProcessing(null);
    }
  };

  const toggleFreeze = async (courseId) => {
    try {
      const res = await API.patch(`/courses/${courseId}/freeze`);
      toast.success(res.data.message);
      loadCourses(selectedProgram);
    } catch (err) {
      toast.error('Failed to toggle freeze.');
    }
  };

  const openCreateModal = () => {
    const nextRound = rounds.length + 1;
    const now = new Date();
    setForm({
      round_number: nextRound,
      opens_at: new Date(now.getTime() + 10 * 60000).toISOString().slice(0, 16),
      closes_at: new Date(now.getTime() + 24 * 3600000).toISOString().slice(0, 16),
      notes: '',
      covers_all_terms: true,
      program_ids: selectedProgram ? [selectedProgram] : programs.map(p => p.id),
    });
    setShowModal(true);
  };

  const activeCourses = courses.filter(c => c.status === 'active');
  const frozenCourses = courses.filter(c => c.is_frozen);
  const selectedProgramObj = programs.find(p => p.id === selectedProgram);
  const selectedRoundPrograms = programs.filter(p => form.program_ids.includes(p.id));
  const toggleRoundProgram = (programId) => {
    setForm(f => ({
      ...f,
      program_ids: f.program_ids.includes(programId)
        ? f.program_ids.filter(id => id !== programId)
        : [...f.program_ids, programId],
    }));
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Round Management</h1>
          <p className="page-subtitle">Manage bidding rounds per program. Create rounds, freeze courses, and trigger allocation.</p>
        </div>
        <button
          id="create-round-btn"
          className="btn btn-primary"
          onClick={openCreateModal}
          disabled={programs.length === 0}
        >
          + New Rounds
        </button>
      </div>

      {/* Program Selector */}
      <div className="card mb-24">
        <span className="form-label" style={{ display: 'block', marginBottom: 8 }}>
          Filter Program
        </span>
        <div className="flex gap-8" style={{ flexWrap: 'wrap' }}>
          <button
            id="round-program-tab-all"
            className={`btn btn-sm ${selectedProgram === '' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setSelectedProgram('')}
          >
            All Programs
          </button>
          {programs.map(p => (
            <button
              key={p.id}
              id={`round-program-tab-${p.id}`}
              className={`btn btn-sm ${selectedProgram === p.id ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setSelectedProgram(p.id)}
            >
              {p.name}
              <span style={{ marginLeft: 6, opacity: 0.7, fontSize: 11 }}>({p.code})</span>
            </button>
          ))}
          {programs.length === 0 && (
            <p className="text-muted text-sm">No active programs. Go to Programs to activate one.</p>
          )}
        </div>
      </div>

      {false ? (
        <div className="card">
          <div className="empty-state" style={{ padding: 64 }}>
            <div className="empty-state-icon">◉</div>
            <h3>Select a Program</h3>
            <p>Choose a program above to view and manage its bidding rounds.</p>
          </div>
        </div>
      ) : (
        <>
          {/* Rounds Table */}
          <div className="card mb-24">
            <h2 className="section-title">
              Bidding Rounds - {selectedProgramObj?.name || 'All Programs'}
            </h2>
            {rounds.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon"></div>
                <h3>No rounds yet</h3>
                <p>Click "+ New Round" to create the first bidding round for this program.</p>
              </div>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Round</th>
                      <th>Opens At</th>
                      <th>Closes At</th>
                      <th>Term</th>
                      <th>Scope</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rounds.map(r => (
                      <tr key={r.id}>
                        <td><strong>Round {r.round_number}</strong></td>
                        <td className="text-muted">{new Date(r.opens_at).toLocaleString()}</td>
                        <td className="text-muted">{new Date(r.closes_at).toLocaleString()}</td>
                        <td className="text-muted">{formatTerm(r.term)}</td>
                        <td>
                          {r.covers_all_terms
                            ? <span className="badge badge-purple">All Terms</span>
                            : <span className="badge badge-blue">Single Term</span>
                          }
                        </td>
                        <td>
                          <span className={`badge ${
                            r.status === 'open' ? 'badge-green'
                            : r.status === 'completed' ? 'badge-blue'
                            : r.status === 'processing' ? 'badge-orange'
                            : r.status === 'upcoming' ? 'badge-purple' : 'badge-red'
                          }`}>{r.status}</span>
                        </td>
                        <td>
                          <div className="flex gap-8">
                            {r.status === 'open' && (
                              <button
                                id={`close-round-${r.round_number}`}
                                className="btn btn-danger btn-sm"
                                onClick={() => forceClose(r.id)}
                                disabled={processing === r.id}
                              >
                                {processing === r.id ? <span className="spin"></span> : null} End & Process
                              </button>
                            )}
                            {r.status === 'closed' && (
                              <button
                                id={`process-round-${r.round_number}`}
                                className="btn btn-success btn-sm"
                                onClick={() => processRound(r.id)}
                                disabled={processing === r.id}
                              >
                                {processing === r.id ? <span className="spin"></span> : null} Process
                              </button>
                            )}
                            {r.status === 'completed' && (
                              <span className="text-muted text-sm">
                                Processed {r.processed_at ? new Date(r.processed_at).toLocaleDateString() : ''}
                              </span>
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

          {/* Course-wise Freeze Control */}
          <div className="card">
            <div className="flex justify-between items-center mb-16">
              <h2 className="section-title" style={{ margin: 0 }}>
                Course Freeze Control - {selectedProgramObj?.name || 'All Programs'}
                <span style={{ marginLeft: 8 }} className="badge badge-red">{frozenCourses.length} frozen</span>
              </h2>
              <p className="text-muted text-sm">Freeze individual courses to stop new bids without closing the whole round</p>
            </div>
            {activeCourses.length === 0 ? (
              <div className="empty-state" style={{ padding: 24 }}>
                <h3>No active courses</h3>
                <p>No active courses found. Add courses in Course Management first.</p>
              </div>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Course Name</th>
                      <th>Faculty</th>
                      <th>Term</th>
                      <th>Criteria</th>
                      <th>Enrolled / Max</th>
                      <th>Float</th>
                      <th>Freeze Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeCourses.map(course => (
                      <tr key={course.id}>
                        <td><strong>{course.code}</strong></td>
                        <td>{course.name}</td>
                        <td className="text-muted">
                          {course.faculty?.name || <em style={{ color: 'var(--accent-orange)' }}>Visiting</em>}
                        </td>
                        <td className="text-muted">{formatTerm(course.term)}</td>
                        <td>
                          <span className={`badge ${
                            course.allocation_criteria === 'cqpi' ? 'badge-blue'
                            : course.allocation_criteria === 'sop' ? 'badge-purple'
                            : 'badge-orange'
                          }`}>
                            {course.allocation_criteria?.toUpperCase()}
                          </span>
                        </td>
                        <td className="text-muted">{course.current_enrollment} / {course.max_strength}</td>
                        <td>
                          {course.is_floated
                            ? <span className="badge badge-green">Floated</span>
                            : <span className="badge badge-orange">Not floated</span>
                          }
                        </td>
                        <td>
                          {course.is_frozen
                            ? <span className="badge badge-red">Frozen ❄</span>
                            : <span className="badge badge-green">Open</span>
                          }
                        </td>
                        <td>
                          <button
                            className={`btn btn-sm ${course.is_frozen ? 'btn-success' : 'btn-danger'}`}
                            onClick={() => toggleFreeze(course.id)}
                          >
                            {course.is_frozen ? 'Unfreeze' : 'Freeze'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Create Round Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 1, paddingBottom: 16, marginBottom: 0 }}>
              <h2 className="modal-title">
                Create Round {form.round_number}
                {selectedRoundPrograms.length > 0 && (
                  <span className="badge badge-purple" style={{ marginLeft: 8, fontSize: 12 }}>
                    {selectedRoundPrograms.length} program{selectedRoundPrograms.length === 1 ? '' : 's'}
                  </span>
                )}
              </h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={createRound}>
              <div className="form-group">
                <label className="form-label">Round Number</label>
                <input
                  id="round-number"
                  type="number"
                  className="form-input"
                  value={form.round_number}
                  onChange={e => setForm(f => ({ ...f, round_number: e.target.value }))}
                  min={1}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Programs *</label>
                <div className="flex gap-8" style={{ flexWrap: 'wrap' }}>
                  {programs.map(p => (
                    <label
                      key={p.id}
                      className={`btn btn-sm ${form.program_ids.includes(p.id) ? 'btn-primary' : 'btn-ghost'}`}
                      style={{ cursor: 'pointer' }}
                    >
                      <input
                        type="checkbox"
                        checked={form.program_ids.includes(p.id)}
                        onChange={() => toggleRoundProgram(p.id)}
                        style={{ marginRight: 6 }}
                      />
                      {p.name}
                      <span style={{ marginLeft: 4, opacity: 0.75 }}>({p.code})</span>
                    </label>
                  ))}
                </div>
                {selectedRoundPrograms.length === 0 && (
                  <p className="form-error mt-8">Select at least one program.</p>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">Opens At</label>
                <input
                  id="round-opens"
                  type="datetime-local"
                  className="form-input"
                  value={form.opens_at}
                  onChange={e => setForm(f => ({ ...f, opens_at: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Closes At</label>
                <input
                  id="round-closes"
                  type="datetime-local"
                  className="form-input"
                  value={form.closes_at}
                  onChange={e => setForm(f => ({ ...f, closes_at: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group">
                <div className="card-glass" style={{ padding: 16 }}>
                  <div>
                    <div className="form-label" style={{ margin: 0, marginBottom: 4 }}>
                      Scope
                    </div>
                    <p className="text-muted text-sm" style={{ margin: 0 }}>
                      One round will be created for each selected program, using the same timing and all-term scope.
                    </p>
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Notes (optional)</label>
                <textarea
                  id="round-notes"
                  className="form-textarea"
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>
              <button id="submit-round" type="submit" className="btn btn-primary w-full" disabled={form.program_ids.length === 0}>
                Create {selectedRoundPrograms.length || ''} Round{selectedRoundPrograms.length === 1 ? '' : 's'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
