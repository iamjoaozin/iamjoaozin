"use client";

import { useImages } from "@/features/images/hooks/useImages";
import { ImageGrid } from "@/features/images/components/ImageGrid";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, SlidersHorizontal, UploadCloud } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function ImagesPage() {
  const { data: images, isLoading } = useImages();

  return (
    <div className="flex flex-col gap-6 h-full animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Biblioteca de Imagens</h1>
          <p className="text-muted-foreground mt-1">Gerencie seu acervo de artes. {images?.length || 0} mídias cadastradas.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline">
            <SlidersHorizontal className="mr-2 h-4 w-4" /> Filtros
          </Button>
          <Button>
            <UploadCloud className="mr-2 h-4 w-4" /> Upload
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4 bg-card border border-border p-2 rounded-lg">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por tags, categorias ou PHash..." className="pl-9 bg-background border-none shadow-none focus-visible:ring-0" />
        </div>
      </div>

      <div className="flex-1">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {Array.from({length: 8}).map((_, i) => (
              <Skeleton key={i} className="h-[380px] w-full rounded-xl" />
            ))}
          </div>
        ) : (
          images && <ImageGrid images={images} />
        )}
      </div>
    </div>
  );
}
