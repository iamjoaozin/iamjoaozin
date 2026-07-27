"use client";

import { useSubreddits } from "@/features/subreddits/hooks/useSubreddits";
import { SubredditsTable } from "@/features/subreddits/components/SubredditsTable";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function SubredditsPage() {
  const { data: subreddits, isLoading } = useSubreddits();

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Subreddits</h1>
          <p className="text-muted-foreground mt-1">Gerencie suas comunidades, regras e cooldowns.</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Adicionar Subreddit
        </Button>
      </div>

      <div className="flex-1">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-[400px] w-full rounded-xl" />
          </div>
        ) : (
          subreddits && <SubredditsTable data={subreddits} />
        )}
      </div>
    </div>
  );
}
