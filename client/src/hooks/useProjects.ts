import { useQuery } from '@tanstack/react-query';
import { getProjects } from '@/lib/api';

export function useProjects() {
  return useQuery({
    queryKey: ['/api/projects'],
    queryFn: () => getProjects(),
  });
}