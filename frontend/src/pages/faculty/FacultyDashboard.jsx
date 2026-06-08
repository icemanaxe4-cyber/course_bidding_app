import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import API from '../../api/client';

const CRITERIA_LABELS = { cqpi: 'CQPI', sop: 'SOP', grade: 'Grade' };
const CRITERIA_COLORS = { cqpi: 'badge-blue', sop: 'badge-purple', grade: 'badge-orange' };
const formatTerm = (term) => term ? `Term ${term.term_number}` : '-';
const getCoursePrograms = (course) => (
  (course.programs?.length ? course.programs : (course.program ? [course.program] : []))
    .filter(program => program.is_active !== false)
);

export default function FacultyDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [myCourses, setMyCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedCourse, setExpandedCourse] = useState(null);
  const [applicantsMap, setApplicantsMap] = useState({});
  const [loadingApplicants, setLoadingApplicants] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.get('/courses');
      setMyCourses(res.data.filter(c => c.faculty_id === user.id));
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const toggleExpand = async (courseId) => {
    if (expandedCourse === courseId) {
      setExpandedCourse(null);
      return;
    }
    setExpandedCourse(courseId);
    if (!applicantsMap[courseId]) {
      setLoadingApplicants(courseId);
      try {
        const res = await API.get(`/courses/${courseId}/applicants`);
        setApplicantsMap(prev => ({ ...prev, [courseId]: res.data }));
      } catch {
        setApplicantsMap(prev => ({ ...prev, [courseId]: [] }));
      } finally {
        setLoadingApplicants(null);
      }
    }
  };

  // Stats
  const activeMy = myCourses.filter(c => c.status === 'active');
  const totalStudents = activeMy.reduce((s, c) => s + (c.current_enrollment || 0), 0);
  const totalApplicants = activeMy.reduce((s, c) => s + (c.applicant_count || 0), 0);

  if (loading) return (
    <div className="empty-state">
      <div className="spin" style={{ fontSize: 32 }}></div>
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Welcome, {user.name.split(' ')[0]} 👋</h1>
          <p className="page-subtitle">
            You are teaching <strong>{myCourses.length}</strong> course{myCourses.length !== 1 ? 's' : ''} this term.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-icon blue"></div>
          <div>
            <div className="stat-value">{myCourses.length}</div>
            <div className="stat-label">My Courses</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"></div>
          <div>
            <div className="stat-value">{activeMy.length}</div>
            <div className="stat-label">Active Courses</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon purple"></div>
          <div>
            <div className="stat-value">{totalStudents}</div>
            <div className="stat-label">Enrolled Students</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon teal"></div>
          <div>
            <div className="stat-value">{totalApplicants}</div>
            <div className="stat-label">Total Applicants</div>
          </div>
        </div>
      </div>

      {/* My Courses */}
      {myCourses.length === 0 ? (
        <div className="card">
          <div className="empty-state" style={{ padding: 64 }}>
            <div className="empty-state-icon">📭</div>
            <h3>No courses assigned yet</h3>
            <p>Once an admin assigns a course to you, it will appear here.</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {myCourses.map(course => {
            const pct = Math.round(((course.current_enrollment || 0) / (course.max_strength || 1)) * 100);
            const isExpanded = expandedCourse === course.id;
            const appList = applicantsMap[course.id] || [];
            const loadingThis = loadingApplicants === course.id;

            return (
              <div key={course.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {/* Course Header */}
                <div style={{ padding: '20px 24px', cursor: 'pointer' }} onClick={() => toggleExpand(course.id)}>
                  <div className="flex justify-between items-center" style={{ marginBottom: 12 }}>
                    <div className="flex items-center gap-12">
                      <div className="course-code">{course.code}</div>
                      <span className={`badge ${
                        course.status === 'active' ? 'badge-green'
                        : course.status === 'cancelled' ? 'badge-red'
                        : 'badge-orange'
                      }`}>{course.status}</span>
                      {course.is_frozen && <span className="badge badge-red">Frozen ❄</span>}
                      {course.is_floated && <span className="badge badge-green">Floated</span>}
                    </div>
                    <div className="flex items-center gap-12">
                      <span className="text-muted text-sm">
                        {isExpanded ? '▲ Hide students' : `▼ View ${course.applicant_count || 0} student${course.applicant_count === 1 ? '' : 's'}`}
                      </span>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={e => { e.stopPropagation(); navigate(`/faculty/courses/${course.id}`); }}
                      >
                        Full Detail →
                      </button>
                    </div>
                  </div>

                  <div className="course-name" style={{ fontSize: 18, marginBottom: 8 }}>{course.name}</div>

                  {course.description && (
                    <p className="text-muted text-sm" style={{ marginBottom: 12, lineHeight: 1.5 }}>{course.description}</p>
                  )}

                  <div className="flex gap-12 items-center" style={{ flexWrap: 'wrap', marginBottom: 14 }}>
                    <span className="text-muted text-sm">{Number(course.credits)} credits</span>
                    <span className={`badge ${CRITERIA_COLORS[course.allocation_criteria] || 'badge-blue'}`} style={{ fontSize: 11 }}>
                      {CRITERIA_LABELS[course.allocation_criteria]}
                    </span>
                    {course.term && (
                      <span className="badge badge-purple" style={{ fontSize: 11 }}>{formatTerm(course.term)}</span>
                    )}
                    {getCoursePrograms(course).map(program => (
                      <span key={program.id} className="badge badge-orange" style={{ fontSize: 11 }}>{program.code}</span>
                    ))}
                    <span className="text-muted text-sm">Min CQPI: {course.cqpi_cutoff}</span>
                  </div>

                  {/* Enrollment bar */}
                  <div>
                    <div className="flex justify-between text-muted text-sm mb-4">
                      <span>Enrollment</span>
                      <span><strong>{course.current_enrollment || 0}</strong> / {course.max_strength} seats ({pct}%)</span>
                    </div>
                    <div className="progress-bar" style={{ height: 8 }}>
                      <div className={`progress-fill ${pct > 85 ? 'warning' : ''}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                    {(course.current_enrollment || 0) < course.min_strength && (
                      <p style={{ color: 'var(--accent-orange)', fontSize: 12, marginTop: 6 }}>
                        ⚠ Below minimum seats ({course.min_strength}) — may be cancelled
                      </p>
                    )}
                  </div>
                </div>

                {/* Expanded: Applicants Table */}
                {isExpanded && (
                  <div style={{ borderTop: '1px solid var(--border)' }}>
                    {loadingThis ? (
                      <div className="empty-state" style={{ padding: 32 }}><div className="spin"></div></div>
                    ) : appList.length === 0 ? (
                      <div className="empty-state" style={{ padding: 32 }}>
                        <div className="empty-state-icon"></div>
                        <h3>No applicants yet</h3>
                      </div>
                    ) : (
                      <div className="table-wrapper">
                        <table>
                          <thead>
                            <tr>
                              <th>#</th>
                              <th>Student</th>
                              <th>ID</th>
                              <th>CQPI</th>
                              <th>Program</th>
                              <th>Preference</th>
                              <th>Status</th>
                              <th>Applied</th>
                            </tr>
                          </thead>
                          <tbody>
                            {appList
                              .sort((a, b) => parseFloat(b.student?.cqpi) - parseFloat(a.student?.cqpi))
                              .map((app, i) => (
                                <tr key={app.id}>
                                  <td className="text-muted">{i + 1}</td>
                                  <td><strong>{app.student?.name}</strong></td>
                                  <td className="text-muted">{app.student?.student_id || '—'}</td>
                                  <td>
                                    <span className={`badge ${parseFloat(app.student?.cqpi) >= parseFloat(course.cqpi_cutoff) ? 'badge-green' : 'badge-red'}`}>
                                      {app.student?.cqpi || '—'}
                                    </span>
                                  </td>
                                  <td className="text-muted">{app.student?.program?.name || '—'}</td>
                                  <td className="text-muted">#{app.preference_order}</td>
                                  <td>
                                    <span className={`badge ${
                                      app.status === 'allocated' ? 'badge-green'
                                      : app.status === 'displaced' ? 'badge-orange'
                                      : app.status === 'cancelled_course' ? 'badge-red'
                                      : 'badge-blue'
                                    }`}>{app.status}</span>
                                  </td>
                                  <td className="text-muted">{new Date(app.applied_at).toLocaleDateString()}</td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
