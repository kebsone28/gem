import { useEffect, useState, useCallback } from 'react';
import type { Mission } from '../components/MissionList';

export default function useMissions(initial: Mission[] | null = null) {
  const [data, setData] = useState<Mission[] | null>(initial);
  const [loading, setLoading] = useState<boolean>(!initial);
  const [error, setError] = useState<any>(null);

  const fetchMissions = useCallback(async (opts = { force: false }) => {
    if (data && !opts.force) return;
    setLoading(true);
    try {
      const res = await fetch('/api/missions');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [data]);

  useEffect(() => {
    fetchMissions();
  }, [fetchMissions]);

  return { data, loading, error, refetch: () => fetchMissions({ force: true }) };
}
