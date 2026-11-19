import { api } from './api';
import { Admin } from './components/Admin';
import { AppHeader } from './components/AppHeader';
import { DealsPage } from './components/DealsPage';
import { ReviewWorkspace } from './components/ReviewWorkspace';
import { useHash } from './navigation';
import { useLoad } from './useLoad';

export function App() {
  const hash = useHash();
  const me = useLoad(api.me, 'me').data;
  const dealId = /^#\/deal\/(.+)$/.exec(hash)?.[1];
  const onAdmin = hash === '#/admin';

  return (
    <div className="app">
      <AppHeader section={onAdmin ? 'admin' : 'deals'} title={me?.title ?? ''} />
      {onAdmin ? (
        <Admin />
      ) : dealId ? (
        <ReviewWorkspace key={dealId} dealId={dealId} />
      ) : (
        <DealsPage demoMode={me?.demoMode ?? false} />
      )}
    </div>
  );
}
