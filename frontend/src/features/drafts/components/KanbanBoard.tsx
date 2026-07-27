"use client";

import { Draft } from "../types/draft";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Image as ImageIcon } from "lucide-react";
import { useSubreddits } from "@/features/subreddits/hooks/useSubreddits";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { DraftService } from "../services/drafts.service";

const COLUMNS = [
  { id: 'pending', label: 'Pendente', color: 'border-yellow-500/50' },
  { id: 'review', label: 'Em Revisão', color: 'border-blue-500/50' },
  { id: 'approved', label: 'Aprovado', color: 'border-emerald-500/50' },
  { id: 'rejected', label: 'Rejeitado', color: 'border-red-500/50' },
];

export function KanbanBoard({ drafts }: { drafts: Draft[] }) {
  const { data: subreddits } = useSubreddits();
  const queryClient = useQueryClient();

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string, status: Draft['status'] }) => DraftService.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drafts'] });
    }
  });

  return (
    <div className="flex gap-6 h-full overflow-x-auto pb-4">
      {COLUMNS.map(col => {
        const columnDrafts = drafts.filter(d => d.status === col.id);
        
        return (
          <div key={col.id} className="flex-shrink-0 w-80 flex flex-col gap-4">
            <div className={`font-semibold flex items-center justify-between pb-2 border-b-2 ${col.color}`}>
              <span>{col.label}</span>
              <Badge variant="secondary">{columnDrafts.length}</Badge>
            </div>
            
            <div className="flex flex-col gap-4 flex-1">
              {columnDrafts.map(draft => {
                const sub = subreddits?.find(s => s.id === draft.subreddit_id);
                return (
                  <Card key={draft.id} className="p-4 cursor-pointer hover:border-primary/50 transition-colors shadow-sm bg-card border-border">
                    <div className="flex gap-3">
                      <div className="h-16 w-16 bg-muted rounded-md border border-border flex items-center justify-center overflow-hidden shrink-0">
                         {draft.image_ids.length > 0 ? (
                           <img src={`https://picsum.photos/seed/${draft.image_ids[0]}/200/200`} className="object-cover w-full h-full" alt="thumbnail" />
                         ) : (
                           <ImageIcon className="h-6 w-6 text-muted-foreground" />
                         )}
                      </div>
                      
                      <div className="flex flex-col flex-1 overflow-hidden">
                        <span className="font-semibold text-sm truncate">{sub?.name || 'Subreddit Desconhecido'}</span>
                        <span className="text-xs text-muted-foreground truncate mt-0.5">Template ID: {draft.template_id}</span>
                        
                        <div className="flex items-center gap-1 mt-auto pt-2 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>{new Date(draft.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  </Card>
                )
              })}
              
              {columnDrafts.length === 0 && (
                <div className="p-4 border-2 border-dashed border-border rounded-xl text-center text-sm text-muted-foreground bg-muted/20">
                  Nenhum draft aqui
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  );
}
