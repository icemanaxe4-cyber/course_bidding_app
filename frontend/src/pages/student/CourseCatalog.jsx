import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import API from '../../api/client';
import toast from 'react-hot-toast';

const formatTerm = (term) => term ? `Term ${term.term_number}` : '-';

export default function CourseCatalog() {
  const { user } = useAuth();
  const [courses, setCourses] = useState([]);
  const [terms, setTerms] = useState([]);
  const [selectedTerm, setSelectedTerm] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [filterEligible, setFilterEligible] = useState(false);

  useEffect(() => {
    API.get('/terms').then(res => {
      setTerms(res.data);
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    API.get('/courses')
      .then(res => setCourses(res.data))
      .catch(() => toast.error('Failed to load courses'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = courses.filter(c => {
    const matchTerm = !selectedTerm || c.term_id === selectedTerm;
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.code.toLowerCase().includes(search.toLowerCase()) ||
      c.faculty?.name?.toLowerCase().includes(search.toLowerCase());
    const matchEligible = !filterEligible || c.is_eligible;
    return matchTerm && matchSearch && matchEligible;
  });

  const catalogTermIds = new Set(courses.map(c => c.term_id).filter(Boolean));
  const catalogTerms = terms.filter(t => catalogTermIds.has(t.id));

  const statusBadge = (s) => {
    if (s === 'active') return <span className="badge badge-green">Active</span>;
    if (s === 'cancelled') return <span className="badge badge-red">Cancelled</span>;
    return <span className="badge badge-orange">{s}</span>;
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title"> Course Catalog</h1>
          <p className="page-subtitle">Browse available courses. Green border = you're eligible.</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-24">
        <div className="flex items-center gap-16" style={{ flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <input
              id="catalog-search"
              type="text"
              className="form-input"
              placeholder=" Search courses or faculty..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div>
            <select
              id="catalog-term"
              className="form-select"
              value={selectedTerm}
              onChange={e => setSelectedTerm(e.target.value)}
              style={{ minWidth: 180 }}
            >
              <option value="">All Terms</option>
              {catalogTerms.map(t => (
                <option key={t.id} value={t.id}>{formatTerm(t)}</option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-8" style={{ cursor: 'pointer', userSelect: 'none' }}>
            <input
              id="catalog-eligible-filter"
              type="checkbox"
              checked={filterEligible}
              onChange={e => setFilterEligible(e.target.checked)}
              style={{ accentColor: 'var(--accent-blue)', width: 16, height: 16 }}
            />
            <span className="text-sm">Eligible only</span>
          </label>
        </div>
      </div>

      {loading ? (
        <div className="empty-state"><div className="spin" style={{ fontSize: 32 }}></div></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"></div>
          <h3>No Courses Found</h3>
          <p>Try adjusting your search or select a different term.</p>
        </div>
      ) : (
        <>
          <p className="text-muted mb-16">{filtered.length} course{filtered.length !== 1 ? 's' : ''} found</p>
          <div className="courses-grid">
            {filtered.map(course => {
              const eligible = course.is_eligible;
              const cancelled = course.status === 'cancelled';
              const enrollPct = Math.round((course.current_enrollment / course.max_strength) * 100);
              const isOverCapacity = Number(course.current_enrollment) > Number(course.max_strength);

              return (
                <div
                  key={course.id}
                  className={`course-card ${!eligible ? 'ineligible' : ''} ${cancelled ? 'cancelled' : ''}`}
                  style={eligible && !cancelled ? { borderColor: 'rgba(16, 185, 129, 0.3)' } : {}}
                >
                  <div className="flex justify-between items-center mb-8">
                    <div className="course-code">{course.code}</div>
                    <div className="flex gap-8">
                      {statusBadge(course.status)}
                      {eligible
                        ? <span className="badge badge-green"> Eligible</span>
                        : <span className="badge badge-red"> Ineligible</span>
                      }
                    </div>
                  </div>

                  <div className="course-name">{course.name}</div>
                  <p className="course-description" style={{ marginTop: 6 }}>{course.description}</p>

                  <div className="course-meta">
                    <span className="course-meta-item"> {course.credits} credits</span>
                    <span className="course-meta-item"> {course.faculty?.name}</span>
                    <span className="course-meta-item"> Min CQPI: {course.cqpi_cutoff}</span>
                  </div>

                  <div style={{ marginTop: 14 }}>
                    <div className="flex justify-between text-muted text-sm mb-8">
                      <span>Enrollment</span>
                      <span style={isOverCapacity ? { color: 'var(--accent-red)', fontWeight: 700 } : {}}>
                        {course.current_enrollment} / {course.max_strength}
                      </span>
                    </div>
                    <div className="progress-bar">
                      <div
                        className={`progress-fill ${enrollPct > 85 ? 'warning' : enrollPct > 60 ? '' : 'success'}`}
                        style={{ width: `${Math.min(enrollPct, 100)}%` }}
                      />
                    </div>
                    {isOverCapacity && (
                      <p className="form-error mt-8">
                        Enrollment exceeds capacity. Ask admin to review duplicate or manual allocations.
                      </p>
                    )}
                  </div>

                  {!eligible && (
                    <p className="form-error mt-8">
                      Your CQPI ({user.cqpi}) is below the {course.cqpi_cutoff} minimum required.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
