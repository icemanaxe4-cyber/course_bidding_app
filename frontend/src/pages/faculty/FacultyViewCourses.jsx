import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import API from '../../api/client';

const CRITERIA_LABELS = { cqpi: 'CQPI', sop: 'SOP', grade: 'Grade' };
const CRITERIA_COLORS = { cqpi: 'badge-blue', sop: 'badge-purple', grade: 'badge-orange' };
import { formatTerm, dedupeTerms } from '../../utils/termUtils';
const getCoursePrograms = (course) => (
  (course.programs?.length ? course.programs : (course.program ? [course.program] : []))
    .filter(program => program.is_active !== false)
);

export default function FacultyViewCourses() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [terms, setTerms] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [termFilter, setTermFilter] = useState('');
  const [programFilter, setProgramFilter] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [coursesRes, termsRes, programsRes] = await Promise.all([
        API.get('/courses'),
        API.get('/terms'),
        API.get('/programs'),
      ]);
      // All courses EXCEPT the faculty's own
      setCourses(coursesRes.data.filter(c => c.faculty_id !== user.id));
      setTerms(termsRes.data);
      setPrograms(programsRes.data.filter(p => p.is_active));
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = courses.filter(c => {
    const matchSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.code.toLowerCase().includes(search.toLowerCase()) ||
      c.faculty?.name?.toLowerCase().includes(search.toLowerCase());
    const matchTerm = !termFilter || c.term_id === termFilter;
    const courseProgramIds = getCoursePrograms(c).map(program => program.id);
    const matchProgram = !programFilter || courseProgramIds.includes(programFilter);
    return matchSearch && matchTerm && matchProgram;
  });

  if (loading) return (
    <div className="empty-state">
      <div className="spin" style={{ fontSize: 32 }}></div>
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">All Courses</h1>
          <p className="page-subtitle">Browse all courses offered across programs and terms (view only).</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-24">
        <div className="flex gap-12 items-center" style={{ flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <input
              id="view-courses-search"
              type="text"
              className="form-input"
              placeholder="Search by course name, code or faculty..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select
            id="view-courses-term"
            className="form-select"
            value={termFilter}
            onChange={e => setTermFilter(e.target.value)}
            style={{ minWidth: 160 }}
          >
            <option value="">All Terms</option>
            {dedupeTerms(terms).map(t => (
              <option key={t.id} value={t.id}>{formatTerm(t)}</option>
            ))}
          </select>
          <select
            id="view-courses-program"
            className="form-select"
            value={programFilter}
            onChange={e => setProgramFilter(e.target.value)}
            style={{ minWidth: 180 }}
          >
            <option value="">All Programs</option>
            {programs.map(p => (
              <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
            ))}
          </select>
          <span className="text-muted text-sm" style={{ whiteSpace: 'nowrap' }}>
            {filtered.length} course{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        {filtered.length === 0 ? (
          <div className="empty-state" style={{ padding: 64 }}>
            <div className="empty-state-icon"></div>
            <h3>No courses found</h3>
            <p>Try a different search or filter.</p>
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
                  <th>Programs</th>
                  <th>Credits</th>
                  <th>Criteria</th>
                  <th>Seats</th>
                  <th>Enrollment</th>
                  <th>Interest</th>
                  <th>Status</th>
                  <th>Flags</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(course => {
                  const pct = Math.round(((course.current_enrollment || 0) / (course.max_strength || 1)) * 100);
                  return (
                    <tr key={course.id}>
                      <td><strong>{course.code}</strong></td>
                      <td>{course.name}</td>
                      <td className="text-muted">
                        {course.is_visiting && !course.faculty
                          ? <em style={{ color: 'var(--accent-orange)' }}>Visiting (TBD)</em>
                          : course.faculty?.name || '—'
                        }
                      </td>
                      <td className="text-muted">{formatTerm(course.term)}</td>
                      <td>
                        <div className="flex gap-4" style={{ flexWrap: 'wrap' }}>
                          {getCoursePrograms(course).length ? getCoursePrograms(course).map(program => (
                            <span key={program.id} className="badge badge-purple" style={{ fontSize: 10 }}>{program.code}</span>
                          )) : <span className="text-muted">—</span>}
                        </div>
                      </td>
                      <td className="text-muted">{Number(course.credits)}</td>
                      <td>
                        <span className={`badge ${CRITERIA_COLORS[course.allocation_criteria] || 'badge-blue'}`} style={{ fontSize: 10 }}>
                          {CRITERIA_LABELS[course.allocation_criteria]}
                        </span>
                      </td>
                      <td className="text-muted">{course.min_strength}–{course.max_strength}</td>
                      <td>
                        <div style={{ minWidth: 90 }}>
                          <div className="flex justify-between text-muted" style={{ fontSize: 11, marginBottom: 3 }}>
                            <span>{course.current_enrollment || 0}</span>
                            <span>{pct}%</span>
                          </div>
                          <div className="progress-bar" style={{ height: 5 }}>
                            <div
                              className={`progress-fill ${pct > 85 ? 'warning' : ''}`}
                              style={{ width: `${Math.min(pct, 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => navigate(`/faculty/courses/${course.id}`)}
                        >
                          {course.applicant_count || 0} student{course.applicant_count === 1 ? '' : 's'}
                        </button>
                      </td>
                      <td>
                        <span className={`badge ${
                          course.status === 'active' ? 'badge-green'
                          : course.status === 'cancelled' ? 'badge-red'
                          : 'badge-orange'
                        }`} style={{ fontSize: 10 }}>{course.status}</span>
                      </td>
                      <td>
                        <div className="flex gap-4">
                          {course.is_floated && <span className="badge badge-green" style={{ fontSize: 10 }}>Floated</span>}
                          {course.is_frozen && <span className="badge badge-red" style={{ fontSize: 10 }}>Frozen</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
