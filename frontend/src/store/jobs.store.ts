import { create } from 'zustand';
import { MOCK_DB } from '../mocks/db';

export type Job = typeof MOCK_DB.jobs[0];

interface JobStore {
  jobs: Job[];
  retryJob: (id: string) => void;
  cancelJob: (id: string) => void;
}

export const useJobStore = create<JobStore>((set) => ({
  jobs: MOCK_DB.jobs,
  retryJob: (id) => set((state) => ({
    jobs: state.jobs.map(job => job.id === id ? { ...job, status: 'pending', attempts: job.attempts + 1 } : job)
  })),
  cancelJob: (id) => set((state) => ({
    jobs: state.jobs.map(job => job.id === id ? { ...job, status: 'canceled' } : job)
  })),
}));
