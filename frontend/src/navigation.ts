// The app's routing by URL hash, and the one place that can refuse to leave a screen.
import { useEffect, useState } from 'react';

// Set while there is unsaved work. Called when the reviewer tries to leave, so its owner can say why not.
let refuse: (() => void) | null = null;

/**
 * Hold the reviewer on the current screen until released. Any move inside the app
 * (a link, the browser's back button) is undone and `onRefused` is called, and the
 * browser asks before the tab is closed or reloaded. Returns the release.
 */
export function blockNavigation(onRefused: () => void): () => void {
  const warn = (event: BeforeUnloadEvent) => event.preventDefault();
  refuse = onRefused;
  addEventListener('beforeunload', warn);
  return () => {
    if (refuse === onRefused) refuse = null;
    removeEventListener('beforeunload', warn);
  };
}

export function useHash() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    let accepted = location.hash;
    const onChange = () => {
      if (refuse && location.hash !== accepted) {
        // Put the address back. replaceState does not fire another hashchange.
        history.replaceState(null, '', location.pathname + location.search + accepted);
        refuse();
        return;
      }
      accepted = location.hash;
      setHash(location.hash);
    };
    addEventListener('hashchange', onChange);
    return () => removeEventListener('hashchange', onChange);
  }, []);
  return hash;
}
