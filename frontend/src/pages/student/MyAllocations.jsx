import { useState, useEffect } from 'react';
import API from '../../api/client';

import { formatTerm, dedupeTerms } from '../../utils/termUtils';
const formatAllocationBadge = (allocation) => {
  if (allocation.allocated_by === 'admin') return 'Admin Assigned';
  if (allocation.round?.round_number) return `Round ${allocation.round.round_number}`;
  return 'Allocated';
};

export default function MyAllocations() {
  const [allocations, setAllocations] = useState([]);
  const [terms, setTerms] = useState([]);
  const [selectedTerm, setSelectedTerm] = useState('');
  const [resultApps, setResultApps] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    API.get('/terms').then(res => {
      setTerms(res.data);
      const active = res.data.find(t => t.status === 'active');
      if (active) setSelectedTerm(active.id);
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    const query = selectedTerm ? `?termId=${selectedTerm}` : '';
    const appsQuery = selectedTerm ? `?termId=${selectedTerm}&includeResults=true` : '?includeResults=true';
    Promise.all([
      API.get(`/allocations/my${query}`),
      API.get(`/applications/my${appsQuery}`),
    ])
      .then(([allocRes, appsRes]) => {
        setAllocations(allocRes.data);
        setResultApps(appsRes.data.sort((a, b) => {
          const roundDiff = (a.round?.round_number || 0) - (b.round?.round_number || 0);
          if (roundDiff !== 0) return roundDiff;
          return (a.preference_order || 0) - (b.preference_order || 0);
        }));
      })
      .finally(() => setLoading(false));
  }, [selectedTerm]);

  const totalCredits = allocations.reduce((sum, a) => sum + (Number(a.course?.credits) || 0), 0);
  const unallocatedApps = resultApps.filter(app => (
    app.status !== 'allocated' && app.status !== 'pending'
  ));

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title"> My Allocations</h1>
          <p className="page-subtitle">Your confirmed course registrations.</p>
        </div>
        <select
          id="allocations-term"
          className="form-select"
          value={selectedTerm}
          onChange={e => setSelectedTerm(e.target.value)}
          style={{ minWidth: 180 }}
        >
          <option value="">All Terms</option>
          {dedupeTerms(terms).map(t => (
            <option key={t.id} value={t.id}>{formatTerm(t)}</option>
          ))}
        </select>
      </div>

      {allocations.length > 0 && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon green"></div>
            <div>
              <div className="stat-value">{allocations.length}</div>
              <div className="stat-label">Courses Allocated</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon blue"></div>
            <div>
              <div className="stat-value">{totalCredits}</div>
              <div className="stat-label">Total Credits</div>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="empty-state"><div className="spin" style={{ fontSize: 32 }}></div></div>
      ) : allocations.length === 0 && unallocatedApps.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon"></div>
            <h3>No Round Results Yet</h3>
            <p>Your allocated and unallocated course results will appear here after rounds are processed.</p>
          </div>
        </div>
      ) : (
        <>
          {allocations.length > 0 && (
            <div className="mb-24">
              <h2 className="section-title">Allocated Courses</h2>
              <div className="courses-grid">
                {allocations.map(alloc => (
                  <div key={alloc.id} className="course-card" style={{ cursor: 'default', borderColor: 'rgba(16,185,129,0.3)' }}>
                    <div className="flex justify-between items-center mb-8">
                      <div className="course-code">{alloc.course?.code}</div>
                      <span className={`badge ${alloc.allocated_by === 'admin' ? 'badge-orange' : 'badge-green'}`}>
                        {formatAllocationBadge(alloc)}
                      </span>
                    </div>
                    <div className="course-name">{alloc.course?.name}</div>
                    {alloc.course?.description && (
                      <p className="course-description mt-8">{alloc.course.description}</p>
                    )}
                    <div className="course-meta mt-12">
                      <span className="course-meta-item"> {alloc.course?.credits} credits</span>
                      <span className="course-meta-item"> {alloc.course?.faculty?.name}</span>
                      <span className="course-meta-item"> {formatTerm(alloc.term)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {unallocatedApps.length > 0 && (
            <div className="card">
              <h2 className="section-title">Interested but Unallocated Courses</h2>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Course</th>
                      <th>Round</th>
                      <th>Preference</th>
                      <th>Status</th>
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unallocatedApps.map(app => (
                      <tr key={app.id}>
                        <td>
                          <strong>{app.course?.name || 'Course unavailable'}</strong>
                          <div className="text-muted text-sm">{app.course?.code || '-'}</div>
                        </td>
                        <td className="text-muted">{app.round ? `Round ${app.round.round_number}` : '-'}</td>
                        <td className="text-muted">#{app.preference_order}</td>
                        <td>
                          <span className={`badge ${app.status === 'cancelled_course' ? 'badge-red' : 'badge-orange'}`}>
                            {app.status === 'cancelled_course' ? 'Cancelled' : 'Not allocated'}
                          </span>
                        </td>
                        <td className="text-muted">{app.unallocation_reason || 'Not allocated in this round.'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
