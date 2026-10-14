import { HashRouter } from 'react-router-dom';
import { AppRoutes } from './cardiotwin__frontend_src__router';

export function App() {
  return (
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppRoutes />
    </HashRouter>
  );
}
