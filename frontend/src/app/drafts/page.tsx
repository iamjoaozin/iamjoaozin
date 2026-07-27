"use client";

import { useDrafts } from "@/features/drafts/hooks/useDrafts";
import { KanbanBoard } from "@/features/drafts/components/KanbanBoard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function DraftsPage() {
  const { data: drafts, isLoading } = useDrafts();

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 h-full overflow-hidden">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Drafts</h1>
          <p className="text-muted-foreground mt-1">Acompanhe o fluxo de aprovação das suas postagens em formato Kanban.</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Novo Draft
        </Button>
      </div>

      <div className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="flex gap-6 h-full">
            {Array.from({length: 4}).map((_, i) => (
              <div key={i} className="w-80 flex flex-col gap-4">
                <Skeleton className="h-8 w-full rounded-md" />
                <Skeleton className="h-32 w-full rounded-xl" />
                <Skeleton className="h-32 w-full rounded-xl" />
              </div>
            ))}
          </div>
        ) : (
          drafts && <KanbanBoard drafts={drafts} />
        )}
      </div>
    </div>
  );
}
