import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

/* Self-hosted fonts: EB Garamond (scholarly serif) + Inter Variable (data sans) */
import '@fontsource/eb-garamond/400.css'
import '@fontsource/eb-garamond/500.css'
import '@fontsource/eb-garamond/600.css'
import '@fontsource/eb-garamond/700.css'
import '@fontsource/eb-garamond/400-italic.css'
import '@fontsource/eb-garamond/600-italic.css'
import '@fontsource-variable/inter'

import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
