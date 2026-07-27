import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { createApiClient } from './api/client';
import { App } from './app/App';
import './styles.css';
import { bootstrapTelegram } from './telegram/telegram';

const telegram = bootstrapTelegram();
const apiClient = createApiClient(telegram.initData);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App apiClient={apiClient} telegram={telegram} />
  </StrictMode>,
);
