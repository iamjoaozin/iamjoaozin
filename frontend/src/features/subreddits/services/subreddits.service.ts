import { Subreddit } from '../types/subreddit';
import { useSubredditStore } from '@/store/subreddits.store';

/**
 * Service mockado. No futuro chamará axios/fetch.
 * Hoje interage com a Store.
 */
export const SubredditService = {
  async getAll(): Promise<Subreddit[]> {
    // Simulando delay de rede
    await new Promise(resolve => setTimeout(resolve, 500));
    return useSubredditStore.getState().subreddits;
  },
  async pause(id: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 300));
    useSubredditStore.getState().pauseSubreddit(id);
  },
  async resume(id: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 300));
    useSubredditStore.getState().resumeSubreddit(id);
  }
};
