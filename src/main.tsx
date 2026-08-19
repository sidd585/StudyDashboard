import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { AuthProvider } from './context/AuthContext';
import { UserProvider } from './context/UserContext';
import { ThemeProvider } from './context/ThemeContext';
import { StudyTimerProvider } from './context/StudyTimerContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <UserProvider>
        <ThemeProvider>
          <StudyTimerProvider>
            <App />
          </StudyTimerProvider>
        </ThemeProvider>
      </UserProvider>
    </AuthProvider>
  </React.StrictMode>
);
