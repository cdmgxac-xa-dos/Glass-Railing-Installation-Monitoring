import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { DataProvider } from './context/DataContext'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <DataProvider>
          <App />
        </DataProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      // Home-screen/standalone launches can stay open for days, so check
      // for a new deploy whenever the app regains focus, not just on load.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') registration.update()
      })
      setInterval(() => registration.update(), 60 * 60 * 1000)
    })
  })

  // Once a new service worker takes over, the page is still running the
  // old JS bundle in memory — reload so users always land on the latest
  // version instead of a stale cached shell.
  let refreshingForUpdate = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshingForUpdate) return
    refreshingForUpdate = true
    window.location.reload()
  })
}
