import { useState, useEffect } from 'react';
import API from '../../api/client';
import toast from 'react-hot-toast';

import { formatTerm, dedupeTerms } from '../../utils/termUtils';

export default function ManualAllocation() {
  const [terms, setTerms] = useState([]);
  const [selectedTerm, setSelectedTerm] = useState('');
  const [displaced, setDisplaced] = useState([]);
  const [courses, setCourses] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('');
  const [allocating, setAllocating] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    API.get('/terms').then(res => {
      setTerms(res.data);
      const active = res.data.find(t => t.status === 'active');
      const fallback = res.data.find(t => t.status !== 'completed');
      if (active || fallback) setSelectedTerm((active || fallback).id);
    });
  }, []);

  const loadData = async (termId) => {
    if (!termId) return;
    setLoading(true);
    try {
      const [dispRes, coursesRes] = await Promise.all([
        API.get(`/allocations/displaced?termId=${termId}`),
        API.get(`/courses?termId=${termId}`),
      ]);
      setDisplaced(dispRes.data);
      setCourses(coursesRes.data.filter(c => c.status === 'active' && c.current_enrollment < c.max_strength));
    } catch (err) {
      toast.error('Failed to load data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(selectedTerm); }, [selectedTerm]);

  const handleAllocate = async (e) => {
    e.preventDefault();
    if (!selectedStudent || !selectedCourse) {
      toast.error('Select both a student and a course.'); return;
    }
    setAllocating(true);
    try {
      await API.post('/allocations/manual', {
        student_id: selectedStudent,
        course_id: selectedCourse,
        term_id: selectedTerm,
      });
      toast.success('Student manually allocated!');
      setSelectedStudent('');
      setSelectedCourse('');
      loadData(selectedTerm);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Allocation failed.');
    } finally {
      setAllocating(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title"> Manual Allocation</h1>
          <p className="page-subtitle">Assign remaining unallocated students to courses manually.</p>
        </div>
        <select
          id="manual-term-select"
          className="form-select"
          value={selectedTerm}
          onChange={e => setSelectedTerm(e.target.value)}
          style={{ minWidth: 180 }}
        >
          <option value="">Select term</option>
          {dedupeTerms(terms).map(t => <option key={t.id} value={t.id}>{formatTerm(t)}</option>)}
        </select>
      </div>

      {selectedTerm && (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon orange"></div>
              <div><div className="stat-value">{displaced.length}</div><div className="stat-label">Unallocated Students</div></div>
            </div>
            <div className="stat-card">
              <div className="stat-icon blue"></div>
              <div><div className="stat-value">{courses.length}</div><div className="stat-label">Available Courses</div></div>
            </div>
          </div>

          {displaced.length > 0 ? (
            <div className="grid-2" style={{ alignItems: 'start' }}>
              {/* Manual assign form */}
              <div className="card">
                <h2 className="section-title">Assign Student to Course</h2>
                <form onSubmit={handleAllocate}>
                  <div className="form-group">
                    <label className="form-label">Select Student</label>
                    <select
                      id="manual-student"
                      className="form-select"
                      value={selectedStudent}
                      onChange={e => setSelectedStudent(e.target.value)}
                      required
                    >
                      <option value="">- Select Student -</option>
                      {displaced.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.student_id}) - CQPI: {s.cqpi}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Select Course</label>
                    <select
                      id="manual-course"
                      className="form-select"
                      value={selectedCourse}
                      onChange={e => setSelectedCourse(e.target.value)}
                      required
                    >
                      <option value="">- Select Course -</option>
                      {courses.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.code} - {c.name} ({c.current_enrollment}/{c.max_strength} seats)
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    id="submit-manual-allocation"
                    type="submit"
                    className="btn btn-primary w-full"
                    disabled={allocating}
                  >
                    {allocating ? 'Assigning...' : ' Assign Student'}
                  </button>
                </form>
              </div>

              {/* Displaced students table */}
              <div className="card">
                <h2 className="section-title">Unallocated Students</h2>
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr><th>Name</th><th>ID</th><th>CQPI</th></tr>
                    </thead>
                    <tbody>
                      {displaced.map(s => (
                        <tr key={s.id}
                          onClick={() => setSelectedStudent(s.id)}
                          style={{ cursor: 'pointer', background: selectedStudent === s.id ? 'rgba(79,142,247,0.08)' : '' }}
                        >
                          <td><strong>{s.name}</strong></td>
                          <td className="text-muted">{s.student_id}</td>
                          <td><span className="badge badge-orange">{s.cqpi}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="empty-state">
                <div className="empty-state-icon"></div>
                <h3>All students allocated!</h3>
                <p>No students are waiting for manual assignment.</p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
