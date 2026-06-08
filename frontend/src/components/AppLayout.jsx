import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const studentNav = [
  { to: '/student/dashboard', icon: '⬡', label: 'Dashboard' },
  { to: '/student/catalog', icon: '◈', label: 'Course Catalog' },
  { to: '/student/selections', icon: '◉', label: 'My Selections' },
  { to: '/student/allocations', icon: '◆', label: 'My Allocations' },
];

const facultyNav = [
  { to: '/faculty/dashboard', icon: '⬡', label: 'Dashboard' },
  { to: '/faculty/courses', icon: '◈', label: 'View Courses' },
];

const adminNav = [
  { to: '/admin/dashboard', icon: '⬡', label: 'Overview' },
  { to: '/admin/programs', icon: '◎', label: 'Programs' },
  { to: '/admin/courses', icon: '◈', label: 'Course Management' },
  { to: '/admin/rounds', icon: '◉', label: 'Round Management' },
  { to: '/admin/allocation', icon: '◆', label: 'Manual Allocation' },
  { to: '/admin/users', icon: '◐', label: 'User Management' },
];

const navByRole = { student: studentNav, faculty: facultyNav, admin: adminNav };
const roleLabels = {
  student: 'Student Portal',
  faculty: 'Faculty Portal',
  admin: 'Admin Portal',
};
const roleColors = {
  student: 'var(--accent-blue)',
  faculty: 'var(--accent-green)',
  admin: 'var(--accent-purple)',
};

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const navItems = navByRole[user?.role] || [];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const initials = user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??';

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect width="28" height="28" rx="8" fill="url(#sgrad)" />
              <path d="M14 5L22 9.5V18.5L14 23L6 18.5V9.5L14 5Z" fill="white" fillOpacity="0.9" />
              <path d="M14 10L18 12.5V17.5L14 20L10 17.5V12.5L14 10Z" fill="white" fillOpacity="0.3" />
              <defs>
                <linearGradient id="sgrad" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#4F46E5" />
                  <stop offset="1" stopColor="#7C3AED" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div>
            <h2>CourseBid</h2>
            <p style={{ color: roleColors[user?.role] }}>{roleLabels[user?.role] || 'Portal'}</p>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-label">Navigation</div>
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-user">
          <div className="user-avatar" style={{ background: roleColors[user?.role] }}>{initials}</div>
          <div className="user-info">
            <div className="user-name">{user?.name}</div>
            <div className="user-role">{user?.role}</div>
          </div>
          <button className="logout-btn" onClick={handleLogout} title="Logout">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 14H3a1 1 0 01-1-1V3a1 1 0 011-1h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M11 11l3-3-3-3M14 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
