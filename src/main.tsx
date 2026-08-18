import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { UserProvider } from './context/UserContext';
import { ThemeProvider } from './context/ThemeContext';
import { StudyTimerProvider } from './context/StudyTimerContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <UserProvider>
      <ThemeProvider>
        <StudyTimerProvider>
          <App />
        </StudyTimerProvider>
      </ThemeProvider>
    </UserProvider>
  </React.StrictMode>
);
