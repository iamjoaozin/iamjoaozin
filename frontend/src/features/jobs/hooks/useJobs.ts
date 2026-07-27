import { useQuery } from '@tanstack/react-query';
import { JobService } from '../services/jobs.service';

export function useJobs() {
  return useQuery({
    queryKey: ['jobs'],
    queryFn: JobService.getAll
  });
}
