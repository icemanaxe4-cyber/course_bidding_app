import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Toaster } from 'react-hot-toast';
import './index.css';

// Pages
import Login from './pages/Login';
import AppLayout from './components/AppLayout';

// Student pages
import StudentDashboard from './pages/student/StudentDashboard';
import CourseCatalog from './pages/student/CourseCatalog';
import MySelections from './pages/student/MySelections';
import MyAllocations from './pages/student/MyAllocations';

// Faculty pages
import FacultyDashboard from './pages/faculty/FacultyDashboard';
import FacultyViewCourses from './pages/faculty/FacultyViewCourses';
import CourseDetail from './pages/faculty/CourseDetail';

// Admin pages
import AdminDashboard from './pages/admin/AdminDashboard';
import TermManagement from './pages/admin/TermManagement';
import RoundManagement from './pages/admin/RoundManagement';
import ManualAllocation from './pages/admin/ManualAllocation';
import UserManagement from './pages/admin/UserManagement';
import AdminCourseManagement from './pages/admin/AdminCourseManagement';
import ProgramManagement from './pages/admin/ProgramManagement';

const ProtectedRoute = ({ children, roles }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
};

const RoleRedirect = () => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'student') return <Navigate to="/student/dashboard" replace />;
  if (user.role === 'faculty') return <Navigate to="/faculty/dashboard" replace />;
  if (user.role === 'admin') return <Navigate to="/admin/dashboard" replace />;
  return <Navigate to="/login" replace />;
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#ffffff',
              color: '#172033',
              border: '1px solid #dfe5ee',
              borderRadius: '8px',
              boxShadow: '0 16px 34px rgba(23, 32, 51, 0.12)',
            },
          }}
        />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<RoleRedirect />} />

          {/* Student Routes */}
          <Route path="/student" element={
            <ProtectedRoute roles={['student']}>
              <AppLayout />
            </ProtectedRoute>
          }>
            <Route path="dashboard" element={<StudentDashboard />} />
            <Route path="catalog" element={<CourseCatalog />} />
            <Route path="selections" element={<MySelections />} />
            <Route path="allocations" element={<MyAllocations />} />
          </Route>

          {/* Faculty Routes — read-only, no create course */}
          <Route path="/faculty" element={
            <ProtectedRoute roles={['faculty']}>
              <AppLayout />
            </ProtectedRoute>
          }>
            <Route path="dashboard" element={<FacultyDashboard />} />
            <Route path="courses" element={<FacultyViewCourses />} />
            <Route path="courses/:id" element={<CourseDetail />} />
            <Route path="course/:id" element={<CourseDetail />} />
          </Route>

          {/* Admin Routes */}
          <Route path="/admin" element={
            <ProtectedRoute roles={['admin']}>
              <AppLayout />
            </ProtectedRoute>
          }>
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="programs" element={<ProgramManagement />} />
            <Route path="terms" element={<TermManagement />} />
            <Route path="courses" element={<AdminCourseManagement />} />
            <Route path="rounds" element={<RoundManagement />} />
            <Route path="allocation" element={<ManualAllocation />} />
            <Route path="users" element={<UserManagement />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
