export interface Job {
  id: string;
  draft_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'canceled';
  attempts: number;
  scheduled_for: string;
  error?: string;
}
