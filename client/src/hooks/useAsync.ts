import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../api/client';

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: ApiError | null;
  reload: () => void;
}

/**
 * Fetch-on-mount with abort + reload. `fetcher` receives an AbortSignal so a
 * stale in-flight request is cancelled when deps change or the component
 * unmounts. `deps` re-trigger the fetch (like useEffect deps).
 */
export function useAsync<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  deps: unknown[],
): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [tick, setTick] = useState(0);

  // Keep the latest fetcher without making it a dependency.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError(null);

    fetcherRef
      .current(controller.signal)
      .then((res) => {
        if (active) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!active) return;
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(
          err instanceof ApiError
            ? err
            : new ApiError(0, 'UNKNOWN', 'Something went wrong'),
        );
        setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  return { data, loading, error, reload };
}

/** Debounce a value by `delay` ms — used to throttle the live payslip preview. */
export function useDebounced<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
