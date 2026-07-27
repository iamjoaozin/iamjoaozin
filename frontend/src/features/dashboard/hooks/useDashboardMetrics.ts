import { useSubreddits } from '@/features/subreddits/hooks/useSubreddits';
import { useJobStore } from '@/store/jobs.store'; // To be migrated to useJobs soon

export function useDashboardMetrics() {
  const { data: subreddits = [] } = useSubreddits();
  const { jobs } = useJobStore();

  const freeSubreddits = subreddits.filter(
    sub => sub.status === 'active' || (sub.status === 'cooldown' && sub.cooldownEnd && new Date(sub.cooldownEnd) < new Date())
  );
  const failedJobs = jobs.filter(job => job.status === 'failed');
  const runningJobs = jobs.filter(job => job.status === 'running');

  return {
    freeSubreddits,
    failedJobs,
    runningJobs,
    totalPostsToday: 5, // mock
  };
}
