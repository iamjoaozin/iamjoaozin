"use client";

import * as React from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { ImageAsset } from "../types/image";
import { Card } from "@/components/ui/card";
import { Heart, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function ImageGrid({ images }: { images: ImageAsset[] }) {
  const parentRef = React.useRef<HTMLDivElement>(null);
  
  // Utilizando 4 colunas em telas grandes. O TanStack Virtual calcula as "linhas"
  const columns = 4;
  const rows = Math.ceil(images.length / columns);

  const virtualizer = useWindowVirtualizer({
    count: rows,
    estimateSize: () => 400, // Altura estimada da linha da grid
    overscan: 2,
  });

  return (
    <div ref={parentRef} className="w-full">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const fromIndex = virtualRow.index * columns;
          const toIndex = Math.min(fromIndex + columns, images.length);
          const rowItems = images.slice(fromIndex, toIndex);

          return (
            <div
              key={virtualRow.key}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
              className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 py-2"
            >
              {rowItems.map((img) => (
                <Card key={img.id} className="group relative overflow-hidden flex flex-col cursor-pointer border-border/50 hover:border-primary/50 transition-colors h-[380px]">
                  <div className="relative flex-1 bg-muted">
                    <img src={img.url} alt="asset" className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-105" loading="lazy" />
                    
                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                       <Button size="icon" variant="secondary" className="h-8 w-8 rounded-full">
                         <Maximize2 className="h-4 w-4" />
                       </Button>
                       <Button size="icon" variant={img.favorite ? "default" : "secondary"} className="h-8 w-8 rounded-full">
                         <Heart className="h-4 w-4 text-rose-500" />
                       </Button>
                    </div>
                    
                    {/* Badges */}
                    <div className="absolute top-2 left-2 flex gap-1">
                      {img.categories.map(cat => (
                        <Badge key={cat} variant="secondary" className="bg-background/80 backdrop-blur-sm shadow-sm capitalize">{cat}</Badge>
                      ))}
                    </div>
                  </div>
                  
                  <div className="p-3 bg-card border-t border-border shrink-0">
                    <div className="flex justify-between items-center text-xs text-muted-foreground">
                      <span>Usos: {img.usages}</span>
                      <span>Score: {img.score}</span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
