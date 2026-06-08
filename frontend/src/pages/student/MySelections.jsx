import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import API from '../../api/client';
import toast from 'react-hot-toast';

const MIN_COURSES_PER_TERM = 1;
const MAX_COURSES_PER_TERM = 3;
const formatTerm = (term) => term ? `Term ${term.term_number}` : '-';

export default function MySelections() {
  const { user } = useAuth();
  const [terms, setTerms] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [courses, setCourses] = useState([]);
  const [selected, setSelected] = useState([]); // [{ course_id, preference_order, course, sop_text? }]
  const [activeRound, setActiveRound] = useState(null);
  const [activeTerm, setActiveTerm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const dragIdx = useRef(null);
  const initialized = useRef(false);
  const autoSaveTimer = useRef(null);

  useEffect(() => {
    const load = async () => {
      try {
        const termsRes = await API.get('/terms');
        setTerms(termsRes.data);
        const active = termsRes.data.find(t => t.status === 'active');
        setActiveTerm(active);

        // Find open round for student's program (or any open round if no program)
        const programId = user?.program_id;
        const roundQuery = programId ? `/rounds?programId=${programId}` : '/rounds';
        const roundsRes = await API.get(roundQuery);
        const openRound = roundsRes.data.find(r => r.status === 'open');
        setRounds(roundsRes.data);
        setActiveRound(openRound);

        if (!openRound) return;

        // Scope courses to the ROUND's program (not just the student's program).
        // The round defines the bidding window — only that program's courses should be visible.
        const roundProgramId = openRound.program_id;

        // Load courses scoped to the round's program and optionally the active term
        const params = new URLSearchParams();
        if (roundProgramId) params.set('programId', roundProgramId);
        if (!openRound.covers_all_terms && active) params.set('termId', active.id);
        const coursesUrl = `/courses${params.toString() ? `?${params.toString()}` : ''}`;

        const coursesRes = await API.get(coursesUrl);
        setCourses(coursesRes.data.filter(c => c.status === 'active' && c.is_eligible));

        const appsRes = await API.get(`/applications/my?roundId=${openRound.id}`);
        setSelected(appsRes.data.map(a => ({
          course_id: a.course_id,
          preference_order: a.preference_order,
          course: a.course,
          sop_text: a.sop_text || '',
        })).sort((a, b) => a.preference_order - b.preference_order));
        initialized.current = true;
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const addCourse = (course) => {
    if (selected.length >= MAX_COURSES_PER_TERM) {
      toast.error(`Maximum ${MAX_COURSES_PER_TERM} courses allowed.`); return;
    }
    if (selected.find(s => s.course_id === course.id)) {
      toast.error('Course already added.'); return;
    }
    setSelected(prev => [...prev, {
      course_id: course.id,
      preference_order: prev.length + 1,
      course,
      sop_text: '',
    }]);
  };

  const removeCourse = (courseId) => {
    setSelected(prev => {
      const updated = prev.filter(s => s.course_id !== courseId);
      return updated.map((s, i) => ({ ...s, preference_order: i + 1 }));
    });
  };

  const updateSop = (courseId, value) => {
    setSelected(prev => prev.map(s => s.course_id === courseId ? { ...s, sop_text: value } : s));
  };

  // Native HTML5 drag-and-drop handlers
  const onDragStart = (idx) => { dragIdx.current = idx; };
  const onDragOver = (e, idx) => {
    e.preventDefault();
    if (dragIdx.current === null || dragIdx.current === idx) return;
    setSelected(prev => {
      const items = [...prev];
      const [moved] = items.splice(dragIdx.current, 1);
      items.splice(idx, 0, moved);
      dragIdx.current = idx;
      return items.map((s, i) => ({ ...s, preference_order: i + 1 }));
    });
  };
  const onDragEnd = () => { dragIdx.current = null; };

  const saveSelections = async ({ silent = false } = {}) => {
    if (!activeRound) return;
    if (selected.length < MIN_COURSES_PER_TERM) {
      if (!silent) toast.error(`Please select at least ${MIN_COURSES_PER_TERM} course.`);
      return;
    }

    // Validate SOP fields
    for (const s of selected) {
      if (s.course?.allocation_criteria === 'sop' && !s.sop_text?.trim()) {
        if (!silent) toast.error(`Please enter your SOP for "${s.course.name}".`);
        return;
      }
    }

    setSaving(true);
    try {
      await API.post('/applications', {
        round_id: activeRound.id,
        selections: selected.map(s => ({
          course_id: s.course_id,
          preference_order: s.preference_order,
          sop_text: s.sop_text || null,
        })),
      });
      if (!silent) toast.success('Selections saved successfully!');
    } catch (err) {
      if (!silent) toast.error(err.response?.data?.error || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!initialized.current || !activeRound) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      saveSelections({ silent: true });
    }, 600);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [selected, activeRound]);

  if (loading) return <div className="empty-state"><div className="spin" style={{ fontSize: 32 }}></div></div>;

  if (!activeTerm) return (
    <div className="empty-state">
      <div className="empty-state-icon"></div>
      <h3>No Active Term</h3>
      <p>Selections open when the office starts a bidding term.</p>
    </div>
  );

  if (!activeRound) return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">My Selections</h1>
          <p className="page-subtitle">{formatTerm(activeTerm)}</p>
        </div>
      </div>
      <div className="round-banner closed">
        <div>
          <span className="badge badge-orange">NO OPEN ROUND</span>
          <p className="text-muted text-sm mt-8">Course selections are only available during open bidding rounds.</p>
        </div>
      </div>
    </div>
  );

  const availableCourses = courses.filter(c => !selected.find(s => s.course_id === c.id));

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">My Selections — Round {activeRound.round_number}</h1>
          <p className="page-subtitle">Drag to reorder. Select {MIN_COURSES_PER_TERM}–{MAX_COURSES_PER_TERM} courses.</p>
        </div>
        <button
          id="save-selections"
          className="btn btn-primary btn-lg"
          onClick={saveSelections}
          disabled={saving || selected.length < MIN_COURSES_PER_TERM}
        >
          {saving ? <><span className="spin"></span> Saving...</> : `Save (${selected.length}/${MAX_COURSES_PER_TERM})`}
        </button>
      </div>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        {/* Selected Courses */}
        <div className="card">
          <div className="flex justify-between items-center mb-16">
            <h2 className="section-title" style={{ marginBottom: 0 }}>Selected Courses</h2>
            <span className={`badge ${selected.length >= MIN_COURSES_PER_TERM ? 'badge-green' : 'badge-orange'}`}>
              {selected.length} / {MAX_COURSES_PER_TERM}
            </span>
          </div>

          {selected.length === 0 ? (
            <div className="empty-state" style={{ padding: '32px 16px' }}>
              <div className="empty-state-icon"></div>
              <h3>No courses selected</h3>
              <p>Add courses from the list on the right.</p>
            </div>
          ) : (
            <div className="selection-list">
              {selected.map((s, idx) => (
                <div
                  key={s.course_id}
                  className="selection-item"
                  draggable
                  onDragStart={() => onDragStart(idx)}
                  onDragOver={(e) => onDragOver(e, idx)}
                  onDragEnd={onDragEnd}
                  style={{ cursor: 'grab' }}
                >
                  <div className="drag-handle" title="Drag to reorder">⠿</div>
                  <div className="selection-rank">{s.preference_order}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{s.course?.name}</div>
                    <div className="text-muted text-sm">
                      {s.course?.code} · {s.course?.credits} cr
                      {s.course?.allocation_criteria && s.course.allocation_criteria !== 'cqpi' && (
                        <span className={`badge ${s.course.allocation_criteria === 'sop' ? 'badge-purple' : 'badge-orange'}`} style={{ marginLeft: 8, fontSize: 10 }}>
                          {s.course.allocation_criteria.toUpperCase()}
                        </span>
                      )}
                    </div>
                    {/* SOP text input for SOP-criteria courses */}
                    {s.course?.allocation_criteria === 'sop' && (
                      <textarea
                        className="form-textarea"
                        style={{ marginTop: 8, minHeight: 72, fontSize: 13 }}
                        placeholder="Write your Statement of Purpose for this course..."
                        value={s.sop_text}
                        onChange={e => updateSop(s.course_id, e.target.value)}
                        onClick={e => e.stopPropagation()}
                      />
                    )}
                  </div>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => removeCourse(s.course_id)}
                    disabled={s.course?.is_frozen}
                    title={s.course?.is_frozen ? 'Frozen course cannot be removed' : 'Remove course'}
                  >{s.course?.is_frozen ? 'Locked' : 'Remove'}</button>
                </div>
              ))}
            </div>
          )}

          {selected.length < MIN_COURSES_PER_TERM && selected.length > 0 && (
            <p className="form-error mt-16">
              Select at least {MIN_COURSES_PER_TERM - selected.length} more course{MIN_COURSES_PER_TERM - selected.length !== 1 ? 's' : ''}.
            </p>
          )}
        </div>

        {/* Available Courses */}
        <div className="card">
          <h2 className="section-title">Available Eligible Courses</h2>
          {courses.length === 0 ? (
            <div className="empty-state" style={{ padding: '32px 16px' }}>
              <div className="empty-state-icon"></div>
              <h3>No eligible courses available</h3>
              <p>No floated courses currently match your CQPI for this term.</p>
            </div>
          ) : availableCourses.length === 0 ? (
            <div className="empty-state" style={{ padding: '32px 16px' }}>
              <div className="empty-state-icon"></div>
              <h3>All eligible courses added!</h3>
            </div>
          ) : (
            <div className="selection-list">
              {availableCourses.map(course => (
                <div key={course.id} className="selection-item" style={{ cursor: 'default' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{course.name}</div>
                    <div className="text-muted text-sm">
                      {course.code} · {course.credits} cr · Min CQPI: {course.cqpi_cutoff}
                      {course.allocation_criteria && course.allocation_criteria !== 'cqpi' && (
                        <span className={`badge ${course.allocation_criteria === 'sop' ? 'badge-purple' : 'badge-orange'}`} style={{ marginLeft: 8, fontSize: 10 }}>
                          {course.allocation_criteria.toUpperCase()} required
                        </span>
                      )}
                    </div>
                    {course.is_frozen && (
                      <span className="badge badge-red" style={{ fontSize: 10, marginTop: 4 }}>Frozen — not accepting bids</span>
                    )}
                  </div>
                  <button
                    id={`add-course-${course.id}`}
                    className="btn btn-secondary btn-sm"
                    onClick={() => addCourse(course)}
                    disabled={selected.length >= MAX_COURSES_PER_TERM || course.is_frozen}
                  >+ Add</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
