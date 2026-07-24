import { useQuery } from '@tanstack/react-query';
import { useAuth } from './useAuth';

export function useFeatureAccess(featureSlug: string) {
  const { isAuthenticated } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['/api/user/feature-access', featureSlug],
    enabled: isAuthenticated,
  });

  return {
    hasAccess: data?.hasAccess || false,
    isLoading,
    featureSlug: data?.featureSlug || featureSlug,
  };
}

export function useMultipleFeatureAccess(featureSlugs: string[]) {
  const { isAuthenticated } = useAuth();

  const queries = featureSlugs.map(slug => ({
    queryKey: ['/api/user/feature-access', slug],
    enabled: isAuthenticated,
  }));

  const results = queries.map(query => useQuery(query));

  return featureSlugs.map((slug, index) => ({
    featureSlug: slug,
    hasAccess: results[index].data?.hasAccess || false,
    isLoading: results[index].isLoading,
  }));
}