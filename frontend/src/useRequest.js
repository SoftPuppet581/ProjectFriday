import { useEffect, useState } from 'react';

export function useRequest(method, ...args) {
  const key = JSON.stringify(args);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!method) return;
    let active = true;
    const finish = (data, error) => {
      if (active) setResult({ method, key, attempt, data, error });
    };
    Promise.resolve()
      .then(() => method(...JSON.parse(key)))
      .then((data) => finish(data, null), (error) => finish(null, error));
    return () => { active = false; };
  }, [method, key, attempt]);

  const current = result?.method === method && result?.key === key && result?.attempt === attempt;
  return {
    data: current ? result.data : null,
    error: current ? result.error : null,
    loading: Boolean(method) && !current,
    retry: () => setAttempt((count) => count + 1),
  };
}
