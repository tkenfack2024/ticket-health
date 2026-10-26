import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
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
import ProfileNotifications from './pages/ProfileNotifications'
import Admin from './pages/Admin'
import ProblemDetail from './pages/admin/ProblemDetail'
import ChangeDetail from './pages/admin/ChangeDetail'
import MyTickets from './pages/portal/MyTickets'
import MyTicketDetail from './pages/portal/MyTicketDetail'
import PortalKb from './pages/portal/Kb'
import PortalKbArticle from './pages/portal/KbArticle'
import PortalCatalog from './pages/portal/Catalog'
import CatalogService from './pages/portal/CatalogService'
import MyRequests from './pages/portal/MyRequests'
import Suppliers from './pages/admin/Suppliers'
import Capacity from './pages/admin/Capacity'
import Resources from './pages/admin/Resources'
import Risks from './pages/admin/Risks'
import Desksharing from './pages/portal/Desksharing'
import Patients from './pages/admin/Patients'
import WaitingRoom from './pages/admin/WaitingRoom'
import MedicalRecord from './pages/admin/MedicalRecord'
import MedicalFollowUp from './pages/admin/MedicalFollowUp'


function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Routes>
          {/* Routes publiques */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Routes BACK-OFFICE (avec Layout) */}
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />

            {/* TICKETS */}
            <Route path="tickets" element={<TicketList />} />
            <Route path="tickets/new" element={<ProtectedRoute><CreateTicket /></ProtectedRoute>} />
            <Route path="tickets/:id" element={<TicketDetail />} />

            {/* KNOWLEDGE */}
            <Route path="knowledge" element={<Knowledge />} />
            <Route path="knowledge/new" element={<KnowledgeEdit />} />
            <Route path="knowledge/:id/edit" element={<KnowledgeEdit />} />
            <Route path="knowledge/:id" element={<KnowledgeArticle />} />

            {/* PROFIL */}
            <Route path="profile/notifications" element={<ProtectedRoute><ProfileNotifications /></ProtectedRoute>} />

            {/* ========================================================= */}
            {/* ROUTES À PERMISSIONS GRANULAIRES (pas de adminOnly)        */}
            {/* Le backend vérifie userHasPermission() sur chaque route    */}
            {/* ========================================================= */}
            <Route path="admin/suppliers" element={<ProtectedRoute><Suppliers /></ProtectedRoute>} />
            <Route path="admin/ressources" element={<ProtectedRoute><Resources /></ProtectedRoute>} />
            <Route path="admin/capacity" element={<ProtectedRoute><Capacity /></ProtectedRoute>} />
            <Route path="admin/risks" element={<ProtectedRoute><Risks /></ProtectedRoute>} />
            <Route path="admin/patients" element={<ProtectedRoute><Patients /></ProtectedRoute>} />
            <Route path="admin/waiting-room" element={<ProtectedRoute><WaitingRoom /></ProtectedRoute>} />
            <Route path="admin/patients/:id/records" element={<ProtectedRoute><MedicalRecord /></ProtectedRoute>} />
            <Route path="admin/medical-followup" element={<ProtectedRoute><MedicalFollowUp /></ProtectedRoute>} />
            <Route path="admin/problems/:id" element={<ProtectedRoute><ProblemDetail /></ProtectedRoute>} />
            <Route path="admin/changes/:id" element={<ProtectedRoute><ChangeDetail /></ProtectedRoute>} />
            <Route path="cmdb/:id" element={<ProtectedRoute><CmdbDetail /></ProtectedRoute>} />

            {/* ========================================================= */}
            {/* ROUTES STRICTEMENT ADMIN (adminOnly conservé)              */}
            {/* ========================================================= */}
            <Route path="admin" element={<ProtectedRoute adminOnly><Admin /></ProtectedRoute>} />
          </Route>

          {/* Routes PORTAIL */}
          <Route path="/portal" element={<ProtectedRoute><PortalLayout /></ProtectedRoute>}>
            <Route index element={<MyTickets />} />
            <Route path="tickets/:id" element={<MyTicketDetail />} />
            <Route path="kb" element={<PortalKb />} />
            <Route path="kb/:id" element={<PortalKbArticle />} />
            <Route path="catalog" element={<PortalCatalog />} />
            <Route path="catalog/:id" element={<CatalogService />} />
            <Route path="my-requests" element={<MyRequests />} />
            <Route path="desksharing" element={<Desksharing />} />
          </Route>
        </Routes>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App