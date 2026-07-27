import { Job } from '@/features/jobs/types/job';

export const mockJobs: Job[] = [
  { id: 'job-1', draft_id: 'draft-2', status: 'running', attempts: 1, scheduled_for: new Date().toISOString() },
  { id: 'job-2', draft_id: 'draft-1', status: 'failed', attempts: 3, scheduled_for: new Date(Date.now() - 3600000).toISOString(), error: 'Reddit API Rate Limit' }
];
