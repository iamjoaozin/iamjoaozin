import { Draft } from '../types/draft';
import { useDraftStore } from '@/store/drafts.store';

export const DraftService = {
  async getAll(): Promise<Draft[]> {
    await new Promise(resolve => setTimeout(resolve, 400));
    return useDraftStore.getState().drafts;
  },
  async updateStatus(id: string, status: Draft['status']): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 300));
    useDraftStore.getState().updateStatus(id, status);
  }
};
