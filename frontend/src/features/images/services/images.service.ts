import { ImageAsset } from '../types/image';
import { useImageStore } from '@/store/images.store';

export const ImageService = {
  async getAll(): Promise<ImageAsset[]> {
    await new Promise(resolve => setTimeout(resolve, 500));
    return useImageStore.getState().images;
  },
  async toggleFavorite(id: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 300));
    useImageStore.getState().toggleFavorite(id);
  }
};
