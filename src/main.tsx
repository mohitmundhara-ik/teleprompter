import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
const App = lazy(() => import('./App'));
const Prompter = lazy(() => import('./teleprompter/Prompter'));
import { applyTheme, readTheme } from './lib/prefs';
import { flushPendingSave } from './state/store';

applyTheme(readTheme());

// A closing window must not take an unsaved edit with it.
window.addEventListener('pagehide', () => flushPendingSave());
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flushPendingSave();
});

const params = new URLSearchParams(location.search);
const isPrompter = params.get('prompter') === '1';
const sessionId = params.get('session') ?? '';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={null}>{isPrompter && sessionId ? <Prompter sessionId={sessionId} /> : <App />}</Suspense>
  </StrictMode>,
);
