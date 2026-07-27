export interface Draft {
  id: string;
  subreddit_id: string;
  template_id: string;
  image_ids: string[];
  status: 'pending' | 'review' | 'approved' | 'rejected';
  created_at: string;
}
