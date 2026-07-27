"use client";

import { useJobs } from "@/features/jobs/hooks/useJobs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Play, Square, RotateCcw } from "lucide-react";
import { useJobStore } from "@/store/jobs.store";

export default function JobsPage() {
  const { data: jobs, isLoading } = useJobs();
  const retryJob = useJobStore(state => state.retryJob);

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Execution Jobs</h1>
          <p className="text-muted-foreground mt-1">Monitore e diagnostique as execuções do robô no Reddit.</p>
        </div>
        <div className="flex gap-2">
           <Button variant="secondary"><RotateCcw className="mr-2 h-4 w-4" /> Retry All Failed</Button>
        </div>
      </div>

      <div className="flex-1 rounded-xl border border-border bg-card shadow-sm overflow-hidden p-0">
        {isLoading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 border-b border-border">
               <tr>
                 <th className="px-4 py-3 font-medium text-muted-foreground">ID do Job</th>
                 <th className="px-4 py-3 font-medium text-muted-foreground">Draft Referência</th>
                 <th className="px-4 py-3 font-medium text-muted-foreground">Status</th>
                 <th className="px-4 py-3 font-medium text-muted-foreground">Tentativas</th>
                 <th className="px-4 py-3 font-medium text-muted-foreground">Erro</th>
                 <th className="px-4 py-3 font-medium text-muted-foreground text-right">Ações</th>
               </tr>
            </thead>
            <tbody>
               {jobs?.map(job => (
                 <tr key={job.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs">{job.id}</td>
                    <td className="px-4 py-3 font-medium">{job.draft_id}</td>
                    <td className="px-4 py-3">
                       <Badge variant={job.status === 'failed' ? 'destructive' : job.status === 'running' ? 'default' : 'secondary'} className="uppercase text-[10px] tracking-wider">
                         {job.status}
                       </Badge>
                    </td>
                    <td className="px-4 py-3">{job.attempts}</td>
                    <td className="px-4 py-3 text-destructive max-w-xs truncate">{job.error || '-'}</td>
                    <td className="px-4 py-3 text-right">
                       <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => retryJob(job.id)} title="Retry">
                             <RotateCcw className="h-4 w-4 text-muted-foreground" />
                          </Button>
                          <Button variant="ghost" size="icon" title="Pausar/Cancelar">
                             <Square className="h-4 w-4 text-muted-foreground" />
                          </Button>
                       </div>
                    </td>
                 </tr>
               ))}
               {jobs?.length === 0 && (
                 <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Nenhum job processado.</td>
                 </tr>
               )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
