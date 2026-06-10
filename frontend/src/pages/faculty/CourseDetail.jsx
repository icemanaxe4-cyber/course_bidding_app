import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import API from '../../api/client';
import toast from 'react-hot-toast';

import { formatTerm } from '../../utils/termUtils';
const getCoursePrograms = (course) => (
  (course.programs?.length ? course.programs : (course.program ? [course.program] : []))
    .filter(program => program.is_active !== false)
);

export default function CourseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [applicants, setApplicants] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      API.get(`/courses/${id}`),
      API.get(`/courses/${id}/applicants`),
    ]).then(([cRes, aRes]) => {
      setCourse(cRes.data);
      setApplicants(aRes.data);
    }).catch(() => toast.error('Failed to load course'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="empty-state"><div className="spin" style={{ fontSize: 32 }}></div></div>;
  if (!course) return <div className="empty-state"><h3>Course not found.</h3></div>;

  const pct = Math.round((course.current_enrollment / course.max_strength) * 100);
  const allottedPrograms = getCoursePrograms(course);

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="course-code">{course.code}</div>
          <h1 className="page-title">{course.name}</h1>
          <p className="page-subtitle">{course.description}</p>
        </div>
        <div className="flex gap-8">
          <span className={`badge ${course.status === 'active' ? 'badge-green' : course.status === 'cancelled' ? 'badge-red' : 'badge-orange'}`}>
            {course.status}
          </span>
          <button className="btn btn-ghost" onClick={() => navigate('/faculty/dashboard')}> Back</button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon blue"></div>
          <div>
            <div className="stat-value">{course.applicant_count || 0}</div>
            <div className="stat-label">Total Applicants</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"></div>
          <div>
            <div className="stat-value">{course.current_enrollment}</div>
            <div className="stat-label">Enrolled Students</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon orange"></div>
          <div>
            <div className="stat-value">{course.cqpi_cutoff}</div>
            <div className="stat-label">CQPI Cutoff</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon purple"></div>
          <div>
            <div className="stat-value">{course.credits}</div>
            <div className="stat-label">Credits</div>
          </div>
        </div>
      </div>

      <div className="card mb-24" style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <span className="form-label" style={{ display: 'block', marginBottom: 6 }}>Programs</span>
          <div className="flex gap-4" style={{ flexWrap: 'wrap' }}>
            {allottedPrograms.length ? allottedPrograms.map(program => (
              <span key={program.id} className="badge badge-purple" style={{ fontSize: 13 }}>
                {program.name} ({program.code})
              </span>
            )) : <span className="text-muted text-sm">-</span>}
          </div>
        </div>
        <div>
          <span className="form-label" style={{ display: 'block', marginBottom: 6 }}>Term</span>
          <span className="badge badge-blue" style={{ fontSize: 13 }}>{formatTerm(course.term)}</span>
        </div>
        <div>
          <span className="form-label" style={{ display: 'block', marginBottom: 6 }}>Allocation Criteria</span>
          <span className={`badge ${course.allocation_criteria === 'cqpi' ? 'badge-blue' : course.allocation_criteria === 'sop' ? 'badge-purple' : 'badge-orange'}`} style={{ fontSize: 13 }}>
            {course.allocation_criteria === 'cqpi' ? 'CQPI Score' : course.allocation_criteria === 'sop' ? 'Statement of Purpose (SOP)' : 'Grade Score (Admin-assigned)'}
          </span>
        </div>
        {course.is_frozen && <span className="badge badge-red" style={{ fontSize: 13 }}>Frozen ❄ — Not accepting bids</span>}
        {course.is_floated && <span className="badge badge-green" style={{ fontSize: 13 }}>Floated — Visible to students</span>}
        {course.is_visiting && <span className="badge badge-orange" style={{ fontSize: 13 }}>Visiting Faculty Course</span>}
      </div>


      <div className="card mb-24">
        <div className="flex justify-between items-center mb-16">
          <h2 className="section-title" style={{ marginBottom: 0 }}>Seat Utilization</h2>
          <span className="text-muted text-sm">{course.current_enrollment} / {course.max_strength} seats</span>
        </div>
        <div className="progress-bar" style={{ height: 10 }}>
          <div className={`progress-fill ${pct > 85 ? 'warning' : ''}`} style={{ width: `${pct}%` }} />
        </div>
        {course.current_enrollment < course.min_strength && (
          <p style={{ color: 'var(--accent-orange)', fontSize: 13, marginTop: 10 }}>
             Current enrollment ({course.current_enrollment}) is below the minimum threshold ({course.min_strength}). Course may be cancelled after round processing.
          </p>
        )}
      </div>

      <div className="card">
        <h2 className="section-title">Applicants ({applicants.length})</h2>
        {applicants.length === 0 ? (
          <div className="empty-state"><div className="empty-state-icon"></div><h3>No applicants yet</h3></div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Student ID</th>
                  <th>CQPI</th>
                  <th>Preference</th>
                  <th>Status</th>
                  <th>Applied At</th>
                </tr>
              </thead>
              <tbody>
                {applicants.sort((a, b) => parseFloat(b.student?.cqpi) - parseFloat(a.student?.cqpi)).map(app => (
                  <tr key={app.id}>
                    <td><strong>{app.student?.name}</strong></td>
                    <td className="text-muted">{app.student?.student_id}</td>
                    <td>
                      <span className={`badge ${parseFloat(app.student?.cqpi) >= parseFloat(course.cqpi_cutoff) ? 'badge-green' : 'badge-red'}`}>
                        {app.student?.cqpi}
                      </span>
                    </td>
                    <td className="text-muted">#{app.preference_order}</td>
                    <td>
                      <span className={`badge ${app.status === 'allocated' ? 'badge-green' : app.status === 'displaced' ? 'badge-orange' : app.status === 'cancelled_course' ? 'badge-red' : 'badge-blue'}`}>
                        {app.status}
                      </span>
                    </td>
                    <td className="text-muted">{new Date(app.applied_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
