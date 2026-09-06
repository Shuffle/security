import { useQuery } from '@tanstack/react-query';
import { getApiUrl, getAuthHeader } from '../api';
import { fetchWorkflowsCached } from '../views/appsFetchCache';

export interface WorkflowSummary {
  id: string;
  name: string;
  description: string;
  is_valid: boolean;
  actions?: any[];
  triggers?: any[];
  tags?: string[];
  background_processing?: boolean;
  [key: string]: any;
}

const fetchWorkflows = async (): Promise<WorkflowSummary[]> => {
  return fetchWorkflowsCached(getApiUrl('/api/v1/workflows'), {
    credentials: 'include',
    headers: { ...getAuthHeader() },
  });
};

export const useWorkflows = () => {
  return useQuery<WorkflowSummary[]>({
    queryKey: ['workflows'],
    queryFn: fetchWorkflows,
    staleTime: 5 * 60 * 1000, // 5 min
    refetchOnWindowFocus: false,
  });
};
