import { useEffect, useState } from 'react';

// Loads once per `key`, and again on reload(). `setData` lets a screen show the
// deal an action returned without fetching it a second time.
export function useLoad<T>(load: () => Promise<T>, key: string) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    load().then(
      (loaded) => {
        if (!current) return;
        setData(loaded);
        setError('');
      },
      (failure: Error) => {
        if (current) setError(failure.message);
      },
    );
    return () => {
      current = false;
    };
    // `load` is a new function on every render; `key` says when it really changed.
  }, [key, attempt]);

  return { data, error, setData, reload: () => setAttempt((n) => n + 1) };
}
