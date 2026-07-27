export interface SubredditRules {
  title_regex?: string;
  max_images?: number;
  forbidden_tags?: string[];
}

export interface Subreddit {
  id: string;
  name: string;
  status: 'active' | 'paused' | 'cooldown';
  priority: 'low' | 'medium' | 'high';
  cooldownEnd: string | null;
  rules: SubredditRules;
}
