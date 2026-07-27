import { Draft } from '@/features/drafts/types/draft';

export const mockDrafts: Draft[] = [
  { id: 'draft-1', subreddit_id: 'sub-1', template_id: 'tpl-1', image_ids: ['img-1'], status: 'pending', created_at: new Date().toISOString() },
  { id: 'draft-2', subreddit_id: 'sub-3', template_id: 'tpl-2', image_ids: ['img-2'], status: 'review', created_at: new Date().toISOString() },
  { id: 'draft-3', subreddit_id: 'sub-5', template_id: 'tpl-2', image_ids: ['img-3', 'img-4'], status: 'approved', created_at: new Date().toISOString() },
  { id: 'draft-4', subreddit_id: 'sub-2', template_id: 'tpl-1', image_ids: ['img-5'], status: 'rejected', created_at: new Date().toISOString() },
];
