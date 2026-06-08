import { useState, useEffect, useCallback } from 'react';
import API from '../../api/client';
import toast from 'react-hot-toast';

const CRITERIA_LABELS = { cqpi: 'CQPI', sop: 'SOP', grade: 'Grade' };
const CRITERIA_COLORS = { cqpi: 'badge-blue', sop: 'badge-purple', grade: 'badge-orange' };
const formatTerm = (term) => term ? `Term ${term.term_number}` : '-';
const getCoursePrograms = (course) => (
  (course.programs?.length ? course.programs : (course.program ? [course.program] : []))
    .filter(program => program.is_active !== false)
);

export default function AdminCourseManagement() {
  const [courses, setCourses] = useState([]);
  const [terms, setTerms] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [selectedProgram, setSelectedProgram] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editCourse, setEditCourse] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showApplicants, setShowApplicants] = useState(null); // courseId
  const [applicants, setApplicants] = useState([]);

  const [form, setForm] = useState({
    code: '', name: '', description: '', credits: 3,
    term_id: '', faculty_id: '', program_ids: [],
    cqpi_cutoff: 0, min_strength: 15, max_strength: 120,
    allocation_criteria: 'cqpi', is_visiting: false,
  });

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (selectedProgram) params.set('programId', selectedProgram);
    if (selectedTerm) params.set('termId', selectedTerm);
    API.get(`/courses${params.toString() ? `?${params.toString()}` : ''}`).then(res => setCourses(res.data));
  }, [selectedProgram, selectedTerm]);

  useEffect(() => {
    Promise.all([
      API.get('/terms'),
      API.get('/programs'),
      API.get('/users?role=faculty'),
    ]).then(([termsRes, programsRes, facultyRes]) => {
      setTerms(termsRes.data);
      setPrograms(programsRes.data);
      setFaculty(facultyRes.data);
    });
  }, []);

  // Derived: only active programs can receive new courses
  const activePrograms = programs.filter(p => p.is_active);
  const inactivePrograms = programs.filter(p => !p.is_active);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditCourse(null);
    setForm({
      code: '', name: '', description: '', credits: 3,
      term_id: selectedTerm || '',
      faculty_id: '', program_ids: selectedProgram ? [selectedProgram] : [],
      cqpi_cutoff: 0, min_strength: 15, max_strength: 120,
      allocation_criteria: 'cqpi', is_visiting: false,
    });
    setShowModal(true);
  };

  const openEdit = (course) => {
    setEditCourse(course);
    const courseProgramIds = getCoursePrograms(course).map(p => p.id);
    setForm({
      code: course.code,
      name: course.name,
      description: course.description || '',
      credits: course.credits,
      term_id: course.term_id,
      faculty_id: course.faculty_id || '',
      program_ids: courseProgramIds,
      cqpi_cutoff: course.cqpi_cutoff,
      min_strength: course.min_strength,
      max_strength: course.max_strength,
      allocation_criteria: course.allocation_criteria || 'cqpi',
      is_visiting: course.is_visiting || false,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.program_ids.length === 0) {
      toast.error('Select at least one program.');
      return;
    }
    if (Number(form.max_strength) < Number(form.min_strength)) {
      toast.error('Max seats must be ≥ min seats.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        credits: Number(form.credits),
        cqpi_cutoff: Number(form.cqpi_cutoff),
        min_strength: Number(form.min_strength),
        max_strength: Number(form.max_strength),
        faculty_id: form.faculty_id || null,
        program_ids: form.program_ids,
        is_visiting: form.is_visiting,
      };
      if (editCourse) {
        await API.put(`/courses/${editCourse.id}`, payload);
        toast.success('Course updated.');
      } else {
        await API.post('/courses', payload);
        toast.success('Course created.');
      }
      setShowModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this course? This cannot be undone.')) return;
    try {
      await API.delete(`/courses/${id}`);
      toast.success('Course deleted.');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed.');
    }
  };

  const toggleStatus = async (course) => {
    const newStatus = course.status === 'active' ? 'cancelled' : 'active';
    try {
      await API.put(`/courses/${course.id}`, { status: newStatus });
      toast.success(`Course ${newStatus === 'active' ? 'activated' : 'deactivated'}.`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed.');
    }
  };

  const toggleFloat = async (course) => {
    try {
      const res = await API.patch(`/courses/${course.id}/float`, {});
      toast.success(res.data.message);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to float course.');
    }
  };

  const toggleFreeze = async (course) => {
    try {
      const res = await API.patch(`/courses/${course.id}/freeze`);
      toast.success(res.data.message);
      setCourses(prev => prev.map(c => (
        c.id === course.id ? { ...c, is_frozen: res.data.course.is_frozen } : c
      )));
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed.');
    }
  };

  const viewApplicants = async (courseId) => {
    try {
      const res = await API.get(`/courses/${courseId}/applicants`);
      setApplicants(res.data);
      setShowApplicants(courseId);
    } catch (err) {
      toast.error('Failed to load applicants.');
    }
  };

  const setGradeScore = async (courseId, appId, score) => {
    try {
      await API.patch(`/courses/${courseId}/applicants/${appId}/grade`, { grade_score: score });
      toast.success('Grade score updated.');
      viewApplicants(courseId);
    } catch (err) {
      toast.error('Failed to update grade.');
    }
  };

  const filtered = courses.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.code.toLowerCase().includes(search.toLowerCase())
  );

  const currentCourse = showApplicants ? courses.find(c => c.id === showApplicants) : null;
  const selectedProgramObj = programs.find(p => p.id === selectedProgram);
  const selectedCoursePrograms = activePrograms.filter(p => form.program_ids.includes(p.id));
  const availableFaculty = faculty.filter(f => f.is_active || f.id === editCourse?.faculty_id);
  const toggleProgram = (programId) => {
    setForm(f => {
      const hasProgram = f.program_ids.includes(programId);
      const program_ids = hasProgram
        ? f.program_ids.filter(id => id !== programId)
        : [...f.program_ids, programId];
      return { ...f, program_ids };
    });
  };

  return (
    <div className="course-management-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Course Management</h1>
          <p className="page-subtitle">Select a program to create, edit, float, and freeze its courses.</p>
        </div>
        <button
          id="create-course-btn"
          className="btn btn-primary"
          onClick={openCreate}
        >
          + New Course
        </button>
      </div>

      {/* Program Selector */}
      <div className="card mb-24">
        <div style={{ marginBottom: 12 }}>
          <span className="form-label" style={{ display: 'block', marginBottom: 8 }}>
            Filter Program <span className="text-muted text-sm" style={{ fontWeight: 400 }}>(only active programs shown)</span>
          </span>
          <div className="flex gap-8" style={{ flexWrap: 'wrap' }}>
            <button
              id="program-tab-all"
              className={`btn btn-sm ${selectedProgram === '' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => { setSelectedProgram(''); setSearch(''); }}
            >
              All Programs
            </button>
            {activePrograms.map(p => (
              <button
                key={p.id}
                id={`program-tab-${p.id}`}
                className={`btn btn-sm ${selectedProgram === p.id ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => { setSelectedProgram(p.id); setSearch(''); }}
              >
                {p.name}
                <span style={{ marginLeft: 6, opacity: 0.7, fontSize: 11 }}>({p.code})</span>
              </button>
            ))}
            {inactivePrograms.map(p => (
              <span
                key={p.id}
                title="Program is inactive — cannot add courses"
                style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 12px', borderRadius: 6, background: 'var(--bg-secondary)', color: 'var(--text-muted)', fontSize: 13, opacity: 0.55, cursor: 'not-allowed', gap: 4 }}
              >
                {p.name} <span style={{ fontSize: 10 }}>({p.code}) ⊘</span>
              </span>
            ))}
            {activePrograms.length === 0 && (
              <p className="text-muted text-sm">No active programs. Go to Programs to activate one.</p>
            )}
          </div>
        </div>
      </div>

      {false ? (
        <div className="card">
          <div className="empty-state" style={{ padding: 64 }}>
            <div className="empty-state-icon">◎</div>
            <h3>Select a Program</h3>
            <p>Choose a program above to view and manage its courses.</p>
          </div>
        </div>
      ) : (
        <>
          {/* Filters */}
          <div className="card mb-24">
            <div className="flex items-center gap-16" style={{ flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <input
                  id="course-search"
                  type="text"
                  className="form-input"
                  placeholder={`Search courses${selectedProgramObj ? ` in ${selectedProgramObj.name}` : ''}...`}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <select
                className="form-select"
                value={selectedTerm}
                onChange={e => setSelectedTerm(e.target.value)}
                style={{ minWidth: 180 }}
              >
                <option value="">All Terms</option>
                {terms.map(t => (
                  <option key={t.id} value={t.id}>{formatTerm(t)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Course Table */}
          <div className="card course-table-card">
            <div className="table-wrapper course-table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Course Name</th>
                    <th>Faculty</th>
                    <th>Term</th>
                    <th>Programs</th>
                    <th>Credits</th>
                    <th>Criteria</th>
                    <th>Seats</th>
                    <th>Interest</th>
                    <th>Flags</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(course => (
                    <tr key={course.id}>
                      <td><strong>{course.code}</strong></td>
                      <td>
                        {course.name}
                        {course.is_visiting && (
                          <span className="badge badge-orange" style={{ marginLeft: 6, fontSize: 10 }}>Visiting</span>
                        )}
                      </td>
                      <td className="text-muted">
                        {course.faculty
                          ? course.faculty.name
                          : <span style={{ color: 'var(--accent-orange)', fontStyle: 'italic' }}>Visiting Faculty</span>
                        }
                      </td>
                      <td className="text-muted">{formatTerm(course.term)}</td>
                      <td>
                        <div className="flex gap-4" style={{ flexWrap: 'wrap' }}>
                          {getCoursePrograms(course).map(p => (
                            <span key={p.id} className="badge badge-purple">{p.code}</span>
                          ))}
                        </div>
                      </td>
                      <td className="text-muted">{Number(course.credits)}</td>
                      <td>
                        <span className={`badge ${CRITERIA_COLORS[course.allocation_criteria] || 'badge-blue'}`}>
                          {CRITERIA_LABELS[course.allocation_criteria] || course.allocation_criteria}
                        </span>
                      </td>
                      <td className="text-muted">{course.min_strength}–{course.max_strength}</td>
                      <td>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => viewApplicants(course.id)}
                          title="View interested students"
                        >
                          {course.applicant_count || 0} student{course.applicant_count === 1 ? '' : 's'}
                        </button>
                      </td>
                      <td>
                        <div className="flex gap-4">
                          {course.is_floated && <span className="badge badge-green">Floated</span>}
                          {course.is_frozen && <span className="badge badge-red">Frozen</span>}
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${
                          course.status === 'active' ? 'badge-green'
                          : course.status === 'cancelled' ? 'badge-red'
                          : 'badge-orange'
                        }`}>{course.status}</span>
                      </td>
                      <td>
                        <div className="course-row-actions">
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => openEdit(course)}
                            title="Edit"
                          >Edit</button>
                          <button
                            className={`btn btn-sm ${course.is_floated ? 'btn-ghost' : 'btn-success'}`}
                            onClick={() => toggleFloat(course)}
                            title={course.is_floated ? 'Unfloat' : 'Float'}
                          >{course.is_floated ? 'Unfloat' : 'Float'}</button>
                          <button
                            className={`btn btn-sm ${course.is_frozen ? 'btn-ghost' : 'btn-danger'}`}
                            onClick={() => toggleFreeze(course)}
                            title={course.is_frozen ? 'Unfreeze' : 'Freeze'}
                          >{course.is_frozen ? 'Unfreeze' : 'Freeze'}</button>
                          <button
                            id={`toggle-status-${course.id}`}
                            className={`btn btn-sm ${course.status === 'active' ? 'btn-danger' : 'btn-success'}`}
                            onClick={() => toggleStatus(course)}
                            title={course.status === 'active' ? 'Deactivate course (hide from students)' : 'Activate course'}
                          >
                            {course.status === 'active' ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDelete(course.id)}
                          >Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan="12">
                        <div className="empty-state" style={{ padding: 32 }}>
                          <div className="empty-state-icon"></div>
                          <h3>No courses found</h3>
                          <p>Click "New Course" to add a course for {selectedProgramObj?.name}.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="course-mobile-list">
              {filtered.map(course => (
                <article key={course.id} className="course-mobile-card">
                  <div className="course-mobile-header">
                    <div>
                      <div className="course-mobile-code">{course.code}</div>
                      <h3 className="course-mobile-title">{course.name}</h3>
                    </div>
                    <span className={`badge ${
                      course.status === 'active' ? 'badge-green'
                      : course.status === 'cancelled' ? 'badge-red'
                      : 'badge-orange'
                    }`}>{course.status}</span>
                  </div>

                  <div className="course-mobile-meta">
                    <div>
                      <span>Faculty</span>
                      <strong>
                        {course.faculty ? course.faculty.name : 'Visiting Faculty'}
                      </strong>
                    </div>
                    <div>
                      <span>Term</span>
                      <strong>{formatTerm(course.term)}</strong>
                    </div>
                    <div>
                      <span>Credits</span>
                      <strong>{Number(course.credits)}</strong>
                    </div>
                    <div>
                      <span>Seats</span>
                      <strong>{course.min_strength}-{course.max_strength}</strong>
                    </div>
                  </div>

                  <div className="course-mobile-badges">
                    <span className={`badge ${CRITERIA_COLORS[course.allocation_criteria] || 'badge-blue'}`}>
                      {CRITERIA_LABELS[course.allocation_criteria] || course.allocation_criteria}
                    </span>
                    {getCoursePrograms(course).map(p => (
                      <span key={p.id} className="badge badge-purple">{p.code}</span>
                    ))}
                    {course.is_visiting && <span className="badge badge-orange">Visiting</span>}
                    {course.is_floated && <span className="badge badge-green">Floated</span>}
                    {course.is_frozen && <span className="badge badge-red">Frozen</span>}
                  </div>

                  <div className="course-mobile-interest">
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => viewApplicants(course.id)}
                    >
                      {course.applicant_count || 0} interested student{course.applicant_count === 1 ? '' : 's'}
                    </button>
                  </div>

                  <div className="course-mobile-actions">
                    <button className="btn btn-secondary btn-sm" onClick={() => openEdit(course)}>Edit</button>
                    <button
                      className={`btn btn-sm ${course.is_floated ? 'btn-ghost' : 'btn-success'}`}
                      onClick={() => toggleFloat(course)}
                    >
                      {course.is_floated ? 'Unfloat' : 'Float'}
                    </button>
                    <button
                      className={`btn btn-sm ${course.is_frozen ? 'btn-ghost' : 'btn-danger'}`}
                      onClick={() => toggleFreeze(course)}
                    >
                      {course.is_frozen ? 'Unfreeze' : 'Freeze'}
                    </button>
                    <button
                      className={`btn btn-sm ${course.status === 'active' ? 'btn-danger' : 'btn-success'}`}
                      onClick={() => toggleStatus(course)}
                    >
                      {course.status === 'active' ? 'Deactivate' : 'Activate'}
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(course.id)}>Delete</button>
                  </div>
                </article>
              ))}
              {filtered.length === 0 && (
                <div className="empty-state" style={{ padding: 32 }}>
                  <h3>No courses found</h3>
                  <p>Click "New Course" to add a course for {selectedProgramObj?.name}.</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 'min(660px, 100%)' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 1, paddingBottom: 16, marginBottom: 0 }}>
              <h2 className="modal-title">{editCourse ? 'Edit Course' : 'Create Course'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Course Code *</label>
                  <input id="course-code" className="form-input" value={form.code}
                    onChange={e => setForm(f => ({ ...f, code: e.target.value }))} required
                    disabled={!!editCourse} placeholder="e.g. MBA601" />
                </div>
                <div className="form-group">
                  <label className="form-label">Credits</label>
                  <input
                    id="course-credits"
                    type="number"
                    className="form-input"
                    value={form.credits}
                    min="0.5"
                    max="12"
                    step="0.5"
                    onChange={e => setForm(f => ({ ...f, credits: e.target.value }))}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Course Name *</label>
                <input id="course-name" className="form-input" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required
                  placeholder="e.g. Strategic Management" />
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="form-textarea" value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Brief course description..." />
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Term *</label>
                  <select className="form-select" value={form.term_id}
                    onChange={e => setForm(f => ({ ...f, term_id: e.target.value }))} required>
                    <option value="">Select term</option>
                    {terms.map(t => (
                      <option key={t.id} value={t.id}>{formatTerm(t)}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Allotted Programs *</label>
                <div className="flex gap-8" style={{ flexWrap: 'wrap' }}>
                  {activePrograms.map(p => (
                    <label key={p.id} className={`btn btn-sm ${form.program_ids.includes(p.id) ? 'btn-primary' : 'btn-ghost'}`} style={{ cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={form.program_ids.includes(p.id)}
                        onChange={() => toggleProgram(p.id)}
                        style={{ marginRight: 6 }}
                      />
                      {p.name} <span style={{ opacity: 0.75 }}>({p.code})</span>
                    </label>
                  ))}
                </div>
                {selectedCoursePrograms.length === 0 && (
                  <p className="form-error mt-8">Select at least one program.</p>
                )}
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">
                    Faculty
                    {form.is_visiting && <span style={{ color: 'var(--accent-orange)', marginLeft: 6, fontSize: 11 }}>optional for visiting</span>}
                  </label>
                  <select className="form-select" value={form.faculty_id}
                    onChange={e => setForm(f => ({ ...f, faculty_id: e.target.value }))}>
                    <option value="">{form.is_visiting ? 'Visiting Faculty (TBD)' : 'Select faculty'}</option>
                    {availableFaculty.map(f => (
                      <option key={f.id} value={f.id}>{f.name} — {f.program?.code || 'Any'} — {f.department || 'No dept.'}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Allocation Criteria</label>
                  <select className="form-select" value={form.allocation_criteria}
                    onChange={e => setForm(f => ({ ...f, allocation_criteria: e.target.value }))}>
                    <option value="cqpi">CQPI (Academic Score)</option>
                    <option value="sop">SOP (Statement of Purpose)</option>
                    <option value="grade">Grade (Admin-assigned Score)</option>
                  </select>
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Min Seats</label>
                  <input type="number" className="form-input" value={form.min_strength} min="1"
                    onChange={e => setForm(f => ({ ...f, min_strength: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Max Seats</label>
                  <input type="number" className="form-input" value={form.max_strength}
                    min={form.min_strength}
                    onChange={e => setForm(f => ({ ...f, max_strength: e.target.value }))} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Min CQPI Cutoff</label>
                <input type="number" className="form-input" value={form.cqpi_cutoff}
                  min="0" max="10" step="0.1"
                  onChange={e => setForm(f => ({ ...f, cqpi_cutoff: e.target.value }))} />
              </div>

              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.is_visiting}
                    onChange={e => setForm(f => ({ ...f, is_visiting: e.target.checked, faculty_id: '' }))} />
                  <span className="form-label" style={{ margin: 0 }}>Visiting Faculty Course (faculty to be decided)</span>
                </label>
              </div>

              <button id="submit-course" type="submit" className="btn btn-primary w-full" disabled={saving || form.program_ids.length === 0}>
                {saving ? 'Saving...' : editCourse ? 'Update Course' : 'Create Course'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Applicants Modal */}
      {showApplicants && (
        <div className="modal-overlay" onClick={() => setShowApplicants(null)}>
          <div className="modal" style={{ maxWidth: 'min(760px, 100%)' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 1, paddingBottom: 16, marginBottom: 0 }}>
              <h2 className="modal-title">
                Interested Students — {currentCourse?.name}
                <span className={`badge ${CRITERIA_COLORS[currentCourse?.allocation_criteria] || 'badge-blue'}`} style={{ marginLeft: 10 }}>
                  {CRITERIA_LABELS[currentCourse?.allocation_criteria]}
                </span>
              </h2>
              {currentCourse && (
                <button
                  className={`btn btn-sm ${currentCourse.is_frozen ? 'btn-ghost' : 'btn-danger'}`}
                  onClick={() => toggleFreeze(currentCourse)}
                >
                  {currentCourse.is_frozen ? 'Unfreeze Course' : 'Freeze Course'}
                </button>
              )}
              <button className="modal-close" onClick={() => setShowApplicants(null)}>✕</button>
            </div>
            {applicants.length === 0 ? (
              <div className="empty-state"><h3>No interested students yet</h3></div>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Student</th>
                      <th>Student ID</th>
                      <th>CQPI</th>
                      <th>Round</th>
                      <th>Pref.</th>
                      <th>Status</th>
                      {currentCourse?.allocation_criteria === 'sop' && <th>SOP Text</th>}
                      {(currentCourse?.allocation_criteria === 'grade' || currentCourse?.allocation_criteria === 'sop') && (
                        <th>Score (Admin)</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {applicants.map((app, i) => (
                      <tr key={app.id}>
                        <td>{i + 1}</td>
                        <td><strong>{app.student?.name}</strong></td>
                        <td className="text-muted">{app.student?.student_id || '-'}</td>
                        <td><span className="badge badge-blue">{app.student?.cqpi || '-'}</span></td>
                        <td className="text-muted">{app.round ? `Round ${app.round.round_number}` : '-'}</td>
                        <td className="text-muted">{app.preference_order}</td>
                        <td>
                          <span className={`badge ${
                            app.status === 'allocated' ? 'badge-green'
                            : app.status === 'displaced' ? 'badge-red'
                            : app.status === 'pending' ? 'badge-orange'
                            : 'badge-purple'
                          }`}>{app.status}</span>
                        </td>
                        {currentCourse?.allocation_criteria === 'sop' && (
                          <td className="text-muted" style={{ maxWidth: 200, wordBreak: 'break-word', fontSize: 12 }}>
                            {app.sop_text || <em>No SOP</em>}
                          </td>
                        )}
                        {(currentCourse?.allocation_criteria === 'grade' || currentCourse?.allocation_criteria === 'sop') && (
                          <td>
                            <div className="flex gap-4 items-center">
                              <input
                                type="number"
                                className="form-input"
                                style={{ width: 70, padding: '4px 8px' }}
                                defaultValue={app.grade_score || ''}
                                placeholder="0-100"
                                min="0" max="100" step="0.1"
                                onBlur={e => {
                                  const val = e.target.value;
                                  if (val !== '' && val !== String(app.grade_score)) {
                                    setGradeScore(showApplicants, app.id, val);
                                  }
                                }}
                              />
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Applicants Modal ends above */}
    </div>
  );
}
