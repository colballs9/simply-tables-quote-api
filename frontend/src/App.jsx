import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { FileText, Plus, Database, Settings } from 'lucide-react'
import QuoteList from './pages/QuoteList'
import QuoteBuilder from './pages/QuoteBuilder'

function Sidebar() {
  return (
    <aside className="app-sidebar">
      <div className="sidebar-logo">
        Simply Tables <span>Quotes</span>
      </div>
      <nav className="sidebar-nav">
        <NavLink to="/" end className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <FileText /> Quotes
        </NavLink>
        <NavLink to="/new" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <Plus /> New Quote
        </NavLink>
        <NavLink to="/catalog" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <Database /> Base Catalog
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <Settings /> Settings
        </NavLink>
      </nav>
    </aside>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-layout">
        <Sidebar />
        <main className="app-main">
          <Routes>
            <Route path="/" element={<QuoteList />} />
            <Route path="/new" element={<QuoteBuilder />} />
            <Route path="/quotes/:quoteId" element={<QuoteBuilder />} />
            <Route path="/catalog" element={<div className="empty-state"><Database size={48} /><p>Base catalog coming soon</p></div>} />
            <Route path="/settings" element={<div className="empty-state"><Settings size={48} /><p>Settings coming soon</p></div>} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
