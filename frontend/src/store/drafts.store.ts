import { create } from 'zustand';
import { Draft } from '@/features/drafts/types/draft';
import { mockDrafts } from '@/mocks/drafts.mock';

interface DraftStore {
  drafts: Draft[];
  updateStatus: (id: string, status: Draft['status']) => void;
}

export const useDraftStore = create<DraftStore>((set) => ({
  drafts: mockDrafts,
  updateStatus: (id, status) => set((state) => ({
    drafts: state.drafts.map(draft => draft.id === id ? { ...draft, status } : draft)
  })),
}));
