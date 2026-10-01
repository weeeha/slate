import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { installWebAdapter } from './web/adapter'
import { installDevMock } from './lib/devMock'
import './styles/global.css'

installWebAdapter()
installDevMock()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
