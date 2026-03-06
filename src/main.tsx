import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

import { TonConnectUIProvider } from '@tonconnect/ui-react'

const manifestUrl = 'https://ton-fusion-lab.vercel.app/tonconnect-manifest.json'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <TonConnectUIProvider manifestUrl={manifestUrl}>
      <App />
    </TonConnectUIProvider>
  </React.StrictMode>
)