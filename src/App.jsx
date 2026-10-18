import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import Layout from './components/Layout'
import PortalLayout from './components/PortalLayout'
import ProtectedRoute from './components/ProtectedRoute'
import Dashboard from './pages/Dashboard'
import TicketList from './pages/TicketList'
import CreateTicket from './pages/CreateTicket'
import TicketDetail from './pages/TicketDetail'
import Knowledge from './pages/Knowledge'
import KnowledgeArticle from './pages/KnowledgeArticle'
import KnowledgeEdit from './pages/KnowledgeEdit'
import CmdbDetail from './pages/admin/CmdbDetail'
import Login from './pages/Login'
import Register from './pages/Register'
import Admin from './pages/Admin'
import ProblemDetail from './pages/admin/ProblemDetail'
import MyTickets from './pages/portal/MyTickets'
import MyTicketDetail from './pages/portal/MyTicketDetail'
import PortalKb from './pages/portal/Kb'
import PortalKbArticle from './pages/portal/KbArticle'

function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Routes publiques (sans Layout) */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Routes ADMIN (avec Layout) */}
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="tickets" element={<TicketList />} />
          <Route path="tickets/:id" element={<TicketDetail />} />
          <Route path="knowledge" element={<Knowledge />} />
          <Route path="knowledge/new" element={<KnowledgeEdit />} />
          <Route path="knowledge/:id/edit" element={<KnowledgeEdit />} />
          <Route path="knowledge/:id" element={<KnowledgeArticle />} />
          <Route
            path="tickets/new"
            element={
              <ProtectedRoute>
                <CreateTicket />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin"
            element={
              <ProtectedRoute adminOnly>
                <Admin />
              </ProtectedRoute>
            }
          />
          <Route
            path="cmdb/:id"
            element={
              <ProtectedRoute adminOnly>
                <CmdbDetail />
              </ProtectedRoute>
            }
          />

<Route
  path="admin/problems/:id"
  element={
    <ProtectedRoute adminOnly>
      <ProblemDetail />
    </ProtectedRoute>
  }
/>
        </Route>

        {/* Routes PORTAIL (avec PortalLayout, séparé du Layout admin) */}
        <Route
          path="/portal"
          element={
            <ProtectedRoute>
              <PortalLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<MyTickets />} />
          <Route path="tickets/:id" element={<MyTicketDetail />} />
          <Route path="kb" element={<PortalKb />} />
          <Route path="kb/:id" element={<PortalKbArticle />} />
        </Route>
      </Routes>
    </AuthProvider>
  )
}

export default App