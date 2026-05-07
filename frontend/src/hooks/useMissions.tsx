import { useEffect, useState, useCallback } from 'react';
import type { Mission } from '../components/MissionList';
import apiClient from '../api/client';

export default function useMissions(initial: Mission[] | null = null) {
  const [data, setData] = useState<Mission[] | null>(initial);
  const [loading, setLoading] = useState<boolean>(!initial);
  const [error, setError] = useState<any>(null);

  const fetchMissions = useCallback(
    async (opts = { force: false }) => {
      if (data && !opts.force) return;
      setLoading(true);
      try {
        const res = await apiClient.get<Mission[]>('/missions');
        setData(res.data);
        setError(null);
      } catch (e) {
        setError(e);
      } finally {
        setLoading(false);
      }
    },
    [data]
  );

  useEffect(() => {
    fetchMissions();
  }, [fetchMissions]);

  return { data, loading, error, refetch: () => fetchMissions({ force: true }) };
}
