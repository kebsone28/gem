import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
// import { seedDatabase } from './store/seed';

// Initialize database with mock data if needed (only in development or if explicitly enabled)
// if (import.meta.env.VITE_ENABLE_MOCKS === 'true') {
//   seedDatabase();
// }

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </AuthProvider>
  </React.StrictMode>,
);
