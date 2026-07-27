import { Job } from '../types/job';
import { useJobStore } from '@/store/jobs.store';

export const JobService = {
  async getAll(): Promise<Job[]> {
    await new Promise(resolve => setTimeout(resolve, 300));
    return useJobStore.getState().jobs;
  }
};
