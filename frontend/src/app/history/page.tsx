"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Link as LinkIcon, ShieldAlert } from "lucide-react";

export default function HistoryPage() {
  const events = [
    { id: 1, type: 'success', title: 'Post publicado com sucesso', sub: 'r/DigitalArt', time: 'Há 10 minutos', url: 'https://reddit.com/p/12345' },
    { id: 2, type: 'error', title: 'Falha de Autenticação (Rate Limit)', sub: 'r/DnD', time: 'Há 1 hora', url: null },
    { id: 3, type: 'info', title: 'Draft aprovado', sub: 'r/HungryArtists', time: 'Há 3 horas', url: null },
  ];

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 h-full">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Histórico e Logs</h1>
        <p className="text-muted-foreground mt-1">Trilha de auditoria e execuções passadas.</p>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="relative border-l-2 border-border ml-4 space-y-8 pb-8">
           {events.map((evt, i) => (
             <div key={evt.id} className="relative pl-8">
               <div className={`absolute -left-[11px] top-1 h-5 w-5 rounded-full border-4 border-background ${
                 evt.type === 'success' ? 'bg-emerald-500' : 
                 evt.type === 'error' ? 'bg-destructive' : 'bg-blue-500'
               }`} />
               
               <Card className="p-4 bg-card border-border shadow-sm w-full max-w-2xl">
                 <div className="flex justify-between items-start">
                   <div className="flex flex-col gap-1">
                     <div className="flex items-center gap-2">
                       <span className="font-semibold">{evt.title}</span>
                       <Badge variant="secondary" className="text-xs font-normal">{evt.sub}</Badge>
                     </div>
                     <span className="text-sm text-muted-foreground">{evt.time}</span>
                   </div>
                   
                   {evt.url && (
                     <a href={evt.url} target="_blank" rel="noreferrer" className="text-primary hover:underline text-sm flex items-center gap-1">
                       <LinkIcon className="h-3 w-3" /> Ver Post
                     </a>
                   )}
                   {evt.type === 'error' && (
                     <div className="text-destructive text-sm flex items-center gap-1">
                       <ShieldAlert className="h-4 w-4" /> Investigar
                     </div>
                   )}
                 </div>
               </Card>
             </div>
           ))}
        </div>
      </div>
    </div>
  );
}
