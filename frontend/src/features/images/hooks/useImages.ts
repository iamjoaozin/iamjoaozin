import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ImageService } from '../services/images.service';

export function useImages() {
  return useQuery({
    queryKey: ['images'],
    queryFn: ImageService.getAll
  });
}

export function useToggleFavoriteImage() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ImageService.toggleFavorite,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['images'] });
    }
  });
}
