import React from 'react'
import ReactDOM from 'react-dom/client'
import { Providers } from '@/app/providers'
import AppRouter from '@/app/router'
import { EnvMissing } from '@/app/EnvMissing'
import { envReady } from '@/lib/env'
// الخط IBM Plex Sans Arabic مضمّن محلياً (يعمل بدون إنترنت في تطبيقات الجوال)
import '@fontsource/ibm-plex-sans-arabic/400.css'
import '@fontsource/ibm-plex-sans-arabic/500.css'
import '@fontsource/ibm-plex-sans-arabic/600.css'
import '@fontsource/ibm-plex-sans-arabic/700.css'
import '@/styles/index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {envReady ? (
      <Providers>
        <AppRouter />
      </Providers>
    ) : (
      <EnvMissing />
    )}
  </React.StrictMode>,
)
