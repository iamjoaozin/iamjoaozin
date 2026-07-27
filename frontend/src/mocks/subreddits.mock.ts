import { Subreddit } from '@/features/subreddits/types/subreddit';

export const mockSubreddits: Subreddit[] = [
  { id: 'sub-1', name: 'r/DigitalArt', status: 'active', priority: 'high', cooldownEnd: null, rules: { title_regex: '^[OC]' } },
  { id: 'sub-2', name: 'r/FantasyArt', status: 'cooldown', priority: 'high', cooldownEnd: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), rules: {} },
  { id: 'sub-3', name: 'r/DnD', status: 'active', priority: 'medium', cooldownEnd: null, rules: {} },
  { id: 'sub-4', name: 'r/AnimeSketch', status: 'cooldown', priority: 'low', cooldownEnd: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(), rules: {} },
  { id: 'sub-5', name: 'r/HungryArtists', status: 'active', priority: 'high', cooldownEnd: null, rules: {} }
];
