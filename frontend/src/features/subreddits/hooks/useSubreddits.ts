import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SubredditService } from '../services/subreddits.service';

export function useSubreddits() {
  return useQuery({
    queryKey: ['subreddits'],
    queryFn: SubredditService.getAll
  });
}

export function usePauseSubreddit() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: SubredditService.pause,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subreddits'] });
    }
  });
}
