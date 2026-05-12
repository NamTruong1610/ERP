import { Link } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'

import AppSidebar from '../../components/AppSidebar'
import './home.css'

export default function Home() {
  const { user } = useAuth()


  const firstName = user?.name?.fName || user?.email?.split('@')[0] || 'there'

  return (
    <div className="home-layout">
      <AppSidebar active="home" />

      <main className="home-main">
        <div className="home-header">
          <div className="home-greeting">
            <span className="home-greeting-sub">Welcome back</span>
            <h1 className="home-greeting-name">Hi, {firstName}</h1>
          </div>
          <div className="home-badge">{user?.roles?.join(', ')}</div>
        </div>

        <div className="home-empty">
          <div className="home-empty-icon">⬡</div>
          <div className="home-empty-title">Nothing here yet</div>
          <div className="home-empty-sub">This is your home page. Content will appear here as the system grows.</div>
        </div>
      </main>
    </div>
  )
}