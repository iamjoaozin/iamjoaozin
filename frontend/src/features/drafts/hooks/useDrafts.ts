import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DraftService } from '../services/drafts.service';

export function useDrafts() {
  return useQuery({
    queryKey: ['drafts'],
    queryFn: DraftService.getAll
  });
}
