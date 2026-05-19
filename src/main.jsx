import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/app.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Fade out the splash overlay after React paints the first frame
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    const splash = document.getElementById('app-splash')
    if (!splash) return
    splash.style.transition = 'opacity 0.35s ease'
    splash.style.opacity = '0'
    setTimeout(() => splash.remove(), 380)
  })
})
