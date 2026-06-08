import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import API from '../../api/client';
import { format, isPast } from 'date-fns';

const formatTerm = (term) => term ? `Term ${term.term_number}` : '-';

function Countdown({ closesAt }) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const update = () => {
      const end = new Date(closesAt);
      if (isPast(end)) { setTimeLeft('Closed'); return; }
      const diff = end - new Date();
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${h}h ${m}m ${s}s`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [closesAt]);

  return <span className="countdown">{timeLeft}</span>;
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const [student, setStudent] = useState(user);
  const [rounds, setRounds] = useState([]);
  const [terms, setTerms] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [program, setProgram] = useState(null);
  const [currentTerm, setCurrentTerm] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const meRes = await API.get('/auth/me');
        const profile = meRes.data.user;
        setStudent(profile);

        const requests = [
          API.get('/terms'),
          API.get('/allocations/my'),
          API.get('/programs'),
        ];

        const [termsRes, allocRes, programsRes] = await Promise.all(requests);
        setTerms(termsRes.data);
        setAllocations(allocRes.data);
        let studentProgram = profile?.program || null;
        if (!studentProgram && profile?.program_id) {
          studentProgram = programsRes.data.find(p => String(p.id) === String(profile.program_id));
        }
        if (studentProgram) setProgram(studentProgram);

        const active = termsRes.data.find(t => t.status === 'active');
        setCurrentTerm(active);

        if (active) {
          const params = new URLSearchParams({ termId: active.id });
          if (profile?.program_id) params.set('programId', profile.program_id);
          const roundsRes = await API.get(`/rounds?${params.toString()}`);
          setRounds(roundsRes.data);
          if (!studentProgram) {
            const roundProgram = roundsRes.data.find(r => r.program)?.program;
            if (roundProgram) setProgram(roundProgram);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user?.id]);

  const displayValue = (value) => value !== null && value !== undefined && value !== '' ? value : '-';
  const programLabel = program?.name || student?.program?.name || '-';
  const activeRound = rounds.find(r => r.status === 'open');
  const upcomingRound = rounds.find(r => r.status === 'upcoming');
  const currentTermAllocations = allocations.filter(a => a.term_id === currentTerm?.id);

  if (loading) return <div className="empty-state"><div className="spin" style={{fontSize:32}}></div></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Welcome back, {student?.name?.split(' ')[0] || 'Student'} </h1>
          <p className="page-subtitle">
            {currentTerm ? `Active term: ${formatTerm(currentTerm)}` : 'No active term currently'}
          </p>
        </div>
        <div className="flex gap-8 items-center">
          <span className="badge badge-blue">CQPI: {student?.cqpi}</span>
          <span className="badge badge-purple">{student?.student_id}</span>
        </div>
      </div>

      <div className="card mb-24">
        <h2 className="section-title">Student Information</h2>
        <div className="grid-3">
          <div>
            <div className="stat-label">Full Name</div>
            <div className="font-bold">{displayValue(student?.name)}</div>
          </div>
          <div>
            <div className="stat-label">Email</div>
            <div className="font-bold">{displayValue(student?.email)}</div>
          </div>
          <div>
            <div className="stat-label">Student ID</div>
            <div className="font-bold">{displayValue(student?.student_id)}</div>
          </div>
          <div>
            <div className="stat-label">Program</div>
            <div className="font-bold">{programLabel}</div>
          </div>
          <div>
            <div className="stat-label">CQPI</div>
            <div className="font-bold">{displayValue(student?.cqpi)}</div>
          </div>
          <div>
            <div className="stat-label">Enrollment Year</div>
            <div className="font-bold">{displayValue(student?.enrollment_year)}</div>
          </div>
          <div>
            <div className="stat-label">Department</div>
            <div className="font-bold">{displayValue(student?.department)}</div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon blue"></div>
          <div>
            <div className="stat-value">{currentTermAllocations.length}</div>
            <div className="stat-label">Courses Allocated</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon purple"></div>
          <div>
            <div className="stat-value">{rounds.length}</div>
            <div className="stat-label">Total Rounds</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"></div>
          <div>
            <div className="stat-value">{allocations.length}</div>
            <div className="stat-label">All-Time Allocations</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon orange"></div>
          <div>
            <div className="stat-value">{student?.cqpi}</div>
            <div className="stat-label">Your CQPI Score</div>
          </div>
        </div>
      </div>

      {/* Active Round Banner */}
      {activeRound && (
        <div className={`round-banner open`}>
          <div>
            <div className="flex items-center gap-8 mb-8">
              <span className="badge badge-green"> ROUND {activeRound.round_number} OPEN</span>
            </div>
            <p className="text-muted text-sm">Submit your course preferences before the round closes.</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="text-muted text-sm mb-8">Time remaining</div>
            <Countdown closesAt={activeRound.closes_at} />
          </div>
        </div>
      )}

      {!activeRound && upcomingRound && (
        <div className="round-banner upcoming">
          <div>
            <div className="flex items-center gap-8 mb-8">
              <span className="badge badge-blue"> ROUND {upcomingRound.round_number} UPCOMING</span>
            </div>
            <p className="text-muted text-sm">
              Opens {format(new Date(upcomingRound.opens_at), 'MMM d, yyyy HH:mm')}
            </p>
          </div>
        </div>
      )}

      {/* Current Term Allocations */}
      {currentTermAllocations.length > 0 && (
        <div className="card mt-24">
          <h2 className="section-title"> Allocated Courses - {formatTerm(currentTerm)}</h2>
          <div className="courses-grid">
            {currentTermAllocations.map(alloc => (
              <div key={alloc.id} className="course-card selected" style={{ cursor: 'default' }}>
                <div className="course-code">{alloc.course?.code}</div>
                <div className="course-name">{alloc.course?.name}</div>
                <div className="course-meta">
                  <span className="course-meta-item"> {alloc.course?.credits} credits</span>
                  <span className="course-meta-item"> {alloc.course?.faculty?.name}</span>
                  {alloc.round && <span className="badge badge-green">Round {alloc.round?.round_number}</span>}
                  {alloc.allocated_by === 'admin' && <span className="badge badge-orange">Admin Assigned</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Round History */}
      {rounds.length > 0 && (
        <div className="card mt-24">
          <h2 className="section-title"> Round History</h2>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Round</th>
                  <th>Opens At</th>
                  <th>Closes At</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rounds.map(r => (
                  <tr key={r.id}>
                    <td><strong>Round {r.round_number}</strong></td>
                    <td className="text-muted">{format(new Date(r.opens_at), 'MMM d, HH:mm')}</td>
                    <td className="text-muted">{format(new Date(r.closes_at), 'MMM d, HH:mm')}</td>
                    <td>
                      <span className={`badge ${
                        r.status === 'open' ? 'badge-green' :
                        r.status === 'completed' ? 'badge-blue' :
                        r.status === 'processing' ? 'badge-orange' :
                        r.status === 'upcoming' ? 'badge-purple' : 'badge-red'
                      }`}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {rounds.length === 0 && currentTermAllocations.length === 0 && !loading && (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon"></div>
            <h3>No Active Bidding</h3>
            <p>Bidding rounds will appear here when the office opens them.</p>
          </div>
        </div>
      )}
    </div>
  );
}
