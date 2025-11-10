import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import CurriculumPage from './pages/CurriculumPage';
import StudentsPage from './pages/StudentsPage';
import ReportsPage from './pages/ReportsPage';
import LibraryPage from './pages/LibraryPage';
import MainLayout from './components/layout/MainLayout';
import ChatBot from './components/ChatBot'; // ✅ Add this import

const App: React.FC = () => {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/app" element={<MainLayout />}>
              <Route index element={<Navigate to="home" replace />} />
              <Route path="home" element={<HomePage />} />
              <Route path="curriculum" element={<CurriculumPage />} />
              <Route path="students" element={<StudentsPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="library" element={<LibraryPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        {/* ✅ ChatBot will now appear on every page */}
        <ChatBot />
      </AuthProvider>
    </Router>
  );
};

export default App;
