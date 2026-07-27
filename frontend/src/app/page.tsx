"use client";

import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useDashboardMetrics } from "@/features/dashboard/hooks/useDashboardMetrics";

export default function Dashboard() {
  const { freeSubreddits, failedJobs, runningJobs, totalPostsToday } = useDashboardMetrics();
  
  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Bem-vindo(a) de volta. Aqui está o resumo operacional do dia.</p>
        </div>
        <Link href="/post">
          <Button>
            <Plus className="mr-2 h-4 w-4" /> Novo Post
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 bg-card border border-border rounded-xl shadow-sm h-32 flex flex-col justify-center">
          <h3 className="text-sm font-medium text-muted-foreground">Posts Hoje</h3>
          <p className="text-3xl font-bold mt-2">{totalPostsToday}</p>
        </div>
        <div className="p-6 bg-card border border-border rounded-xl shadow-sm h-32 flex flex-col justify-center">
          <h3 className="text-sm font-medium text-muted-foreground">Falhas Recentes</h3>
          <p className="text-3xl font-bold mt-2 text-destructive">{failedJobs.length}</p>
        </div>
        <div className="p-6 bg-card border border-border rounded-xl shadow-sm h-32 flex flex-col justify-center">
          <h3 className="text-sm font-medium text-muted-foreground">Subs Livres de Cooldown</h3>
          <p className="text-3xl font-bold mt-2 text-emerald-500">{freeSubreddits.length}</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
        <div className="border border-border bg-card rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">Oportunidades (Recomendações)</h2>
          <div className="space-y-4">
             {freeSubreddits.slice(0, 5).map(sub => (
               <div key={sub.id} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div>
                     <p className="font-medium">{sub.name}</p>
                     <p className="text-sm text-muted-foreground">Pronto para postagem</p>
                  </div>
                  <Link href={`/post?subreddit=${sub.id}`}>
                    <Button variant="secondary" size="sm">Postar</Button>
                  </Link>
               </div>
             ))}
             {freeSubreddits.length === 0 && (
               <p className="text-sm text-muted-foreground">Nenhuma oportunidade no momento.</p>
             )}
          </div>
        </div>
        
        <div className="border border-border bg-card rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">Execution Jobs (Live)</h2>
          <div className="space-y-4">
             {runningJobs.map(job => (
               <div key={job.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                  <div className="flex items-center gap-3">
                     <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                     <div>
                        <p className="font-medium text-sm">Draft ID: {job.draft_id}</p>
                        <p className="text-xs text-muted-foreground">Tentativa {job.attempts}</p>
                     </div>
                  </div>
                  <span className="text-xs font-semibold px-2 py-1 bg-blue-500/10 text-blue-500 rounded-md uppercase">{job.status}</span>
               </div>
             ))}
             {runningJobs.length === 0 && (
               <p className="text-sm text-muted-foreground">Nenhum job rodando agora.</p>
             )}
          </div>
        </div>
      </div>
    </div>
  );
}
