import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const userData = await login(form.email, form.password);
      const role = userData.role;
      if (role === 'admin') navigate('/admin/dashboard');
      else if (role === 'faculty') navigate('/faculty/dashboard');
      else navigate('/student/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* Left Panel */}
      <div className="login-left">
        <div className="login-brand">
          <div className="login-logo">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <rect width="40" height="40" rx="12" fill="url(#grad)" />
              <path d="M20 8L32 14V26L20 32L8 26V14L20 8Z" fill="white" fillOpacity="0.9" />
              <path d="M20 14L26 17V23L20 26L14 23V17L20 14Z" fill="white" fillOpacity="0.4" />
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#4F46E5" />
                  <stop offset="1" stopColor="#7C3AED" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div className="login-brand-text">
            <h1>CourseBid</h1>
            <p>XLRI Academic Portal</p>
          </div>
        </div>

        <div className="login-hero">
          <h2>Smart Course Allocation for XLRI</h2>
          <p>
            A transparent, merit-based bidding system for MBA course allocation.
            Faculty, students, and administrators — all in one unified platform.
          </p>
          <div className="login-features">
            <div className="login-feature-item">
              <span className="login-feature-dot green"></span>
              <span>Criteria-based allocation — CQPI, SOP, or Grade</span>
            </div>
            <div className="login-feature-item">
              <span className="login-feature-dot blue"></span>
              <span>Multi-term bidding in a single round</span>
            </div>
            <div className="login-feature-item">
              <span className="login-feature-dot purple"></span>
              <span>Real-time round management & course controls</span>
            </div>
            <div className="login-feature-item">
              <span className="login-feature-dot orange"></span>
              <span>Program-wise course and student management</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="login-right">
        <div className="login-card">
          <div className="login-card-header">
            <h2>Sign In</h2>
            <p>Enter your credentials provided by the administrator</p>
          </div>

          {error && (
            <div className="login-error" role="alert">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                <path d="M8 5v3M8 10.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label className="form-label" htmlFor="login-email">Email Address</label>
              <div className="input-with-icon">
                <svg className="input-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect x="1" y="3" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M1 5l7 5 7-5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                </svg>
                <input
                  id="login-email"
                  type="email"
                  name="email"
                  className="form-input with-icon"
                  placeholder="you@xlri.ac.in"
                  value={form.email}
                  onChange={handleChange}
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="login-password">Password</label>
              <div className="input-with-icon">
                <svg className="input-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect x="3" y="7" width="10" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M5 7V5a3 3 0 016 0v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <input
                  id="login-password"
                  type="password"
                  name="password"
                  className="form-input with-icon"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={handleChange}
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>

            <button
              id="login-submit"
              type="submit"
              className="btn btn-primary btn-lg w-full login-submit-btn"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spin" style={{ width: 18, height: 18 }}></span>
                  Signing in...
                </>
              ) : (
                <>
                  Sign In
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </>
              )}
            </button>
          </form>

          <div className="login-admin-note">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2" />
              <path d="M7 6v4M7 4.5v.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            <span>Don't have an account? Contact your administrator to create one.</span>
          </div>

          <div className="login-roles-hint">
            <p>Access roles</p>
            <div className="login-roles">
              <span className="login-role-badge student">Student</span>
              <span className="login-role-badge faculty">Faculty</span>
              <span className="login-role-badge admin">Admin</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
