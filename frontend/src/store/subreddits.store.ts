import { create } from 'zustand';
import { Subreddit } from '@/features/subreddits/types/subreddit';
import { mockSubreddits } from '@/mocks/subreddits.mock';

interface SubredditStore {
  subreddits: Subreddit[];
  setSubreddits: (subs: Subreddit[]) => void;
  pauseSubreddit: (id: string) => void;
  resumeSubreddit: (id: string) => void;
}

export const useSubredditStore = create<SubredditStore>((set) => ({
  subreddits: mockSubreddits, // Initial mock state
  setSubreddits: (subs) => set({ subreddits: subs }),
  pauseSubreddit: (id) => set((state) => ({
    subreddits: state.subreddits.map(sub => sub.id === id ? { ...sub, status: 'paused' } : sub)
  })),
  resumeSubreddit: (id) => set((state) => ({
    subreddits: state.subreddits.map(sub => sub.id === id ? { ...sub, status: 'active' } : sub)
  }))
}));
