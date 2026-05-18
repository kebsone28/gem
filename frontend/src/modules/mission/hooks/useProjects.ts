import { useState, useEffect } from 'react';
import { useProject } from '@/contexts/ProjectContext';
import logger from '@/utils/logger';

export const useProjects = () => {
  const { projects } = useProject();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsLoading(false);
  }, [projects]);

  return {
    projects: projects || [],
    isLoading,
  };
};
