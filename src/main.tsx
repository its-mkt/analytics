import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { AccessGate } from './components/AccessGate';
import { AuthProvider } from './context/AuthContext';
import './styles/main.scss';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <AccessGate>
        <App />
      </AccessGate>
    </AuthProvider>
  </StrictMode>,
);
