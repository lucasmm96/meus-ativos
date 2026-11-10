import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import { OfflineBanner } from './components'
import { Login } from './routes/Login'
import { Dashboard } from './routes/Dashboard'
import { AtivosExplorer } from './routes/AtivosExplorer'
import { AtivoHistorico } from './routes/AtivoHistorico'
import { Transactions } from './routes/Transactions'
import { Perfil } from './routes/Perfil'

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return null
  return user ? <>{children}</> : <Navigate to="/login" replace />
}

function AppRoutes() {
  const { user, loading } = useAuth()
  const location = useLocation()
  return (
    <Routes>
      <Route path="/login" element={loading ? null : (user ? <Navigate to="/" replace /> : <Login />)} />
      <Route path="/" element={<Protected><Dashboard key={location.key} /></Protected>} />
      <Route path="/ativos" element={<Protected><AtivosExplorer /></Protected>} />
      <Route path="/ativos/:ticker" element={<Protected><AtivoHistorico /></Protected>} />
      <Route path="/transactions" element={<Protected><Transactions /></Protected>} />
      <Route path="/perfil" element={<Protected><Perfil /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <OfflineBanner />
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}
