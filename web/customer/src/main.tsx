import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { QueryProvider } from './app/providers/QueryProvider';
import { NotificationProvider } from './app/providers/NotificationProvider';
import { AppRouter } from './app/Router';
import './styles/globals.css';

// Initialize auth store — registers sign-out callback with apiClient
import './store/authStore';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <QueryProvider>
        {/*
          NotificationProvider must be inside BrowserRouter (needs useNavigate)
          and inside QueryProvider (needs useQueryClient).
        */}
        <NotificationProvider>
          <AppRouter />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3000,
              style: {
                background: '#FFFFFF',
                color: '#0F172A',
                fontFamily: 'Inter, system-ui, sans-serif',
                fontSize: '14px',
                fontWeight: '600',
                borderRadius: '14px',
                boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
                padding: '12px 16px',
              },
              success: {
                iconTheme: { primary: '#10B981', secondary: '#FFFFFF' },
              },
              error: {
                iconTheme: { primary: '#EF4444', secondary: '#FFFFFF' },
              },
            }}
          />
        </NotificationProvider>
      </QueryProvider>
    </BrowserRouter>
  </StrictMode>,
);
