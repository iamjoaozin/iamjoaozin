import { create } from 'zustand';
import { ImageAsset } from '@/features/images/types/image';
import { mockImages } from '@/mocks/images.mock';

interface ImageStore {
  images: ImageAsset[];
  toggleFavorite: (id: string) => void;
  deleteImage: (id: string) => void;
}

export const useImageStore = create<ImageStore>((set) => ({
  images: mockImages,
  toggleFavorite: (id) => set((state) => ({
    images: state.images.map(img => img.id === id ? { ...img, favorite: !img.favorite } : img)
  })),
  deleteImage: (id) => set((state) => ({
    images: state.images.filter(img => img.id !== id)
  }))
}));
