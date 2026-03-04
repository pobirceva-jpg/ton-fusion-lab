import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { TonConnectUIProvider } from '@tonconnect/ui-react'

// Это обязательно для TonConnect — оборачиваем всё приложение
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TonConnectUIProvider 
      manifestUrl="https://ton.org/tonconnect-manifest.json"  // временный публичный манифест
      // actionsConfiguration={{ twaReturnUrl: 'https://t.me/your_bot' }} — добавишь позже
    >
      <App />
    </TonConnectUIProvider>
  </React.StrictMode>,
)