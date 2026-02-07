import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { Farms } from './pages/Farms'
import { Users } from './pages/Users'
import { Settings } from './pages/Settings'
import { Alerts } from './pages/Alerts'
import { Analysis } from './pages/Analysis'
import { Layout } from './components/Layout'

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const token = localStorage.getItem('token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="farms" element={<Farms />} />
          <Route path="users" element={<Users />} />
          <Route path="settings" element={<Settings />} />
          <Route path="alerts" element={<Alerts />} />
          <Route path="analysis" element={<Analysis />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
