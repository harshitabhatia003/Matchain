import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { WalletProvider } from './services/wallet';
import { AuthProvider } from './context/AuthContext';

const savedTheme = window.localStorage.getItem('matchain-theme');
document.documentElement.dataset.theme = savedTheme === 'light' ? 'light' : 'dark';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <WalletProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </WalletProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
