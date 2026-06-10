import { useState, useEffect } from 'react';
import API from '../../api/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

import { formatTerm, dedupeTerms } from '../../utils/termUtils';

export default function AdminDashboard() {
  const [terms, setTerms] = useState([]);
  const [selectedTerm, setSelectedTerm] = useState('');
  const [stats, setStats] = useState(null);
  const [rounds, setRounds] = useState([]);
  const [termsLoading, setTermsLoading] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    API.get('/terms').then(res => {
      const loadedTerms = res.data;
      setTerms(loadedTerms);
      const active = loadedTerms.find(t => t.status === 'active');
      if (active) setSelectedTerm(active.id);
    }).finally(() => setTermsLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedTerm) return;
    setLoading(true);
    Promise.all([
      API.get(`/allocations/stats?termId=${selectedTerm}`),
      API.get(`/rounds?termId=${selectedTerm}`),
    ]).then(([statsRes, roundsRes]) => {
      setStats(statsRes.data);
      setRounds(roundsRes.data);
    }).finally(() => setLoading(false));
  }, [selectedTerm]);

  const chartData = rounds.map(r => ({
    name: `Round ${r.round_number}`,
    status: r.status,
  }));

  const currentTerm = terms.find(t => t.id === selectedTerm);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title"> Admin Overview</h1>
          <p className="page-subtitle">Monitor the bidding process in real time</p>
        </div>
        {terms.length > 0 && (
          <select
            id="admin-term-select"
            className="form-select"
            value={selectedTerm}
            onChange={e => setSelectedTerm(e.target.value)}
            style={{ minWidth: 200 }}
          >
            <option value="">Select term</option>
            {dedupeTerms(terms).map(t => <option key={t.id} value={t.id}>{formatTerm(t)}</option>)}
          </select>
        )}
      </div>

      {termsLoading && (
        <div className="empty-state"><div className="spin" style={{ fontSize: 32 }}></div></div>
      )}

      {!termsLoading && terms.length === 0 && (
        <div className="empty-state"><div className="empty-state-icon"></div><h3>No terms started yet</h3></div>
      )}

      {!termsLoading && terms.length > 0 && !selectedTerm && (
        <div className="empty-state"><div className="empty-state-icon"></div><h3>Select a term to view statistics</h3></div>
      )}

      {selectedTerm && loading && (
        <div className="empty-state"><div className="spin" style={{ fontSize: 32 }}></div></div>
      )}

      {selectedTerm && stats && !loading && (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon blue"></div>
              <div><div className="stat-value">{stats.totalStudents}</div><div className="stat-label">Total Students</div></div>
            </div>
            <div className="stat-card">
              <div className="stat-icon green"></div>
              <div><div className="stat-value">{stats.allocatedStudents}</div><div className="stat-label">Students Allocated</div></div>
            </div>
            <div className="stat-card">
              <div className="stat-icon orange"></div>
              <div><div className="stat-value">{stats.unallocatedStudents}</div><div className="stat-label">Unallocated Students</div></div>
            </div>
            <div className="stat-card">
              <div className="stat-icon purple"></div>
              <div><div className="stat-value">{stats.activeCourses}</div><div className="stat-label">Active Courses</div></div>
            </div>
            <div className="stat-card">
              <div className="stat-icon red"></div>
              <div><div className="stat-value">{stats.cancelledCourses}</div><div className="stat-label">Cancelled Courses</div></div>
            </div>
            <div className="stat-card">
              <div className="stat-icon teal"></div>
              <div><div className="stat-value">{stats.totalAllocations}</div><div className="stat-label">Total Allocations</div></div>
            </div>
          </div>

          {/* Allocation Progress */}
          <div className="card mb-24">
            <h2 className="section-title">Allocation Progress</h2>
            <div className="flex justify-between text-muted text-sm mb-8">
              <span>Students allocated</span>
              <span>{stats.allocatedStudents} / {stats.totalStudents} ({Math.round((stats.allocatedStudents / stats.totalStudents) * 100) || 0}%)</span>
            </div>
            <div className="progress-bar" style={{ height: 12 }}>
              <div
                className="progress-fill success"
                style={{ width: `${Math.round((stats.allocatedStudents / stats.totalStudents) * 100) || 0}%` }}
              />
            </div>
          </div>

          {/* Rounds table */}
          <div className="card">
            <h2 className="section-title">Bidding Rounds - {formatTerm(currentTerm)}</h2>
            {rounds.length === 0 ? (
              <div className="empty-state"><div className="empty-state-icon"></div><h3>No rounds created yet</h3></div>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Round</th>
                      <th>Opens At</th>
                      <th>Closes At</th>
                      <th>Status</th>
                      <th>Processed At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rounds.map(r => (
                      <tr key={r.id}>
                        <td><strong>Round {r.round_number}</strong></td>
                        <td className="text-muted">{new Date(r.opens_at).toLocaleString()}</td>
                        <td className="text-muted">{new Date(r.closes_at).toLocaleString()}</td>
                        <td>
                          <span className={`badge ${
                            r.status === 'open' ? 'badge-green' :
                            r.status === 'completed' ? 'badge-blue' :
                            r.status === 'processing' ? 'badge-orange' :
                            r.status === 'upcoming' ? 'badge-purple' : 'badge-red'
                          }`}>{r.status}</span>
                        </td>
                        <td className="text-muted">{r.processed_at ? new Date(r.processed_at).toLocaleString() : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
