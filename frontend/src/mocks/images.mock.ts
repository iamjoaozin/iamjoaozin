import { ImageAsset } from '@/features/images/types/image';

export const mockImages: ImageAsset[] = Array.from({ length: 50 }).map((_, i) => ({
  id: `img-${i}`,
  phash: `hash-${i * 100}`,
  url: `https://picsum.photos/seed/${i + 10}/400/600`,
  favorite: i % 5 === 0,
  usages: Math.floor(Math.random() * 20),
  score: Math.floor(Math.random() * 100),
  categories: i % 2 === 0 ? ['fantasy'] : ['scifi'],
  tags: ['commission', 'portrait'],
  created_at: new Date(Date.now() - Math.random() * 10000000000).toISOString()
}));
