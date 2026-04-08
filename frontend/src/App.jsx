import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { FileText, Plus, Database, Settings, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import QuoteList from './pages/QuoteList'
import QuoteBuilder from './pages/QuoteBuilder'

const SIDEBAR_KEY = 'st-sidebar-collapsed'

function useSidebarState() {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(SIDEBAR_KEY) === 'true' } catch { return false }
  })

  useEffect(() => {
    try { localStorage.setItem(SIDEBAR_KEY, String(collapsed)) } catch {}
  }, [collapsed])

  return [collapsed, setCollapsed]
}

export default function App() {
  const [collapsed, setCollapsed] = useSidebarState()

  return (
    <BrowserRouter>
      <div className={`app-layout${collapsed ? ' app-layout--sidebar-collapsed' : ''}`}>
        <aside className={`app-sidebar${collapsed ? ' app-sidebar--collapsed' : ''}`}>
          <div className="sidebar-top">
            <div className="sidebar-logo">
              {collapsed ? 'ST' : <>Simply Tables <span>Quotes</span></>}
            </div>
            <button className="sidebar-toggle" onClick={() => setCollapsed(v => !v)} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
              {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            </button>
          </div>
          <nav className="sidebar-nav">
            <NavLink to="/" end className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} title="Quotes">
              <FileText /> {!collapsed && <span>Quotes</span>}
            </NavLink>
            <NavLink to="/new" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} title="New Quote">
              <Plus /> {!collapsed && <span>New Quote</span>}
            </NavLink>
            <NavLink to="/catalog" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} title="Base Catalog">
              <Database /> {!collapsed && <span>Base Catalog</span>}
            </NavLink>
            <NavLink to="/settings" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} title="Settings">
              <Settings /> {!collapsed && <span>Settings</span>}
            </NavLink>
          </nav>
        </aside>
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
