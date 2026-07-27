"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useSubreddits } from "@/features/subreddits/hooks/useSubreddits";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, Sparkles, Send, Plus } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

export default function PostWizardPage() {
  const { data: subreddits } = useSubreddits();
  const [selectedSub, setSelectedSub] = useState<string>("");
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeSub = subreddits?.find(s => s.id === selectedSub);

  const handleSubmit = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      toast.success("Post adicionado à fila de execução!");
      setStep(3);
    }, 1500);
  };

  return (
    <div className="max-w-4xl mx-auto h-full flex flex-col gap-8 animate-in fade-in duration-500 py-6 w-full">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Criar Postagem</h1>
        <p className="text-muted-foreground mt-1">Assistente inteligente de postagens.</p>
      </div>

      {/* Timeline */}
      <div className="flex gap-4 mb-4 items-center">
        <div className={`flex items-center gap-2 ${step >= 1 ? 'text-primary' : 'text-muted-foreground'}`}>
           <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold transition-colors ${step >= 1 ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>1</div>
           <span className="font-medium text-sm sm:text-base">Subreddit</span>
        </div>
        <div className={`flex-1 border-t-2 my-auto transition-colors ${step >= 2 ? 'border-primary' : 'border-border'}`} />
        <div className={`flex items-center gap-2 ${step >= 2 ? 'text-primary' : 'text-muted-foreground'}`}>
           <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold transition-colors ${step >= 2 ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>2</div>
           <span className="font-medium text-sm sm:text-base">Conteúdo</span>
        </div>
        <div className={`flex-1 border-t-2 my-auto transition-colors ${step >= 3 ? 'border-primary' : 'border-border'}`} />
        <div className={`flex items-center gap-2 ${step >= 3 ? 'text-primary' : 'text-muted-foreground'}`}>
           <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold transition-colors ${step >= 3 ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>3</div>
           <span className="font-medium text-sm sm:text-base">Conclusão</span>
        </div>
      </div>

      {step === 1 && (
        <Card className="p-6 bg-card border-border shadow-sm flex flex-col gap-6 animate-in slide-in-from-bottom-2 duration-300">
          <div>
            <h2 className="text-xl font-semibold mb-2">1. Onde você quer postar?</h2>
            <p className="text-sm text-muted-foreground">O sistema carregará automaticamente as regras e templates adequados.</p>
          </div>
          
          <Select value={selectedSub} onValueChange={setSelectedSub}>
            <SelectTrigger className="w-full h-12 text-base">
              <SelectValue placeholder="Selecione um Subreddit..." />
            </SelectTrigger>
            <SelectContent>
              {subreddits?.filter(s => s.status !== 'paused').map(sub => (
                <SelectItem key={sub.id} value={sub.id} disabled={sub.status === 'cooldown'}>
                  <div className="flex items-center justify-between w-full">
                    <span>{sub.name}</span>
                    {sub.status === 'cooldown' && <Badge variant="destructive" className="ml-2 bg-destructive/20 text-destructive border-none shadow-none text-xs">Em Cooldown</Badge>}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {activeSub && (
            <div className="bg-primary/10 text-primary border border-primary/20 p-4 rounded-lg flex flex-col gap-3 mt-4 animate-in zoom-in-95 duration-300">
              <div className="flex items-center gap-2 font-semibold">
                <Sparkles className="h-4 w-4" />
                <span>Template Sugerido</span>
              </div>
              <p className="text-sm opacity-90">Como o <strong>{activeSub.name}</strong> exige a flag `[OC]`, já aplicamos o template <em>"Character Design"</em> e ocultamos imagens NSFW.</p>
            </div>
          )}

          <div className="flex justify-end mt-6 pt-4 border-t border-border">
            <Button disabled={!selectedSub} onClick={() => setStep(2)}>Próximo Passo</Button>
          </div>
        </Card>
      )}

      {step === 2 && activeSub && (
        <Card className="p-6 bg-card border-border shadow-sm flex flex-col gap-6 animate-in slide-in-from-right-4 duration-300">
          <div>
            <h2 className="text-xl font-semibold mb-2">2. Revise o Conteúdo</h2>
            <p className="text-sm text-muted-foreground">Postando em {activeSub.name}</p>
          </div>

          <div className="grid gap-6">
             <div className="space-y-2">
               <label className="text-sm font-medium">Título da Postagem</label>
               <Input defaultValue={`[OC] Character Design - Commission Open`} className="font-semibold" />
             </div>
             
             <div className="space-y-2">
               <label className="text-sm font-medium">Corpo (Opcional)</label>
               <Textarea defaultValue={`Hi guys, this is my latest commission.\n\nOpen for new slots! DM me.`} className="h-32 resize-none" />
             </div>

             <div className="space-y-3">
               <label className="text-sm font-medium flex items-center justify-between">
                 <span>Imagens ({activeSub.rules.max_images || 1} permitidas)</span>
                 <Button variant="ghost" size="sm" className="h-8 text-xs"><Search className="h-3 w-3 mr-1"/> Buscar na Biblioteca</Button>
               </label>
               <div className="flex gap-4">
                  <div className="h-28 w-28 rounded-lg bg-muted border-2 border-primary/50 overflow-hidden relative group cursor-pointer shadow-sm">
                    <img src="https://picsum.photos/seed/10/400/600" className="object-cover w-full h-full" />
                  </div>
                  <Button variant="outline" className="h-28 w-28 border-dashed bg-muted/20 hover:bg-muted/50 transition-colors">
                    <Plus className="h-6 w-6 text-muted-foreground" />
                  </Button>
               </div>
             </div>
          </div>
          
          <div className="flex justify-between mt-6 pt-4 border-t border-border">
            <Button variant="ghost" onClick={() => setStep(1)}>Voltar</Button>
            <div className="flex gap-3">
               <Button variant="secondary" onClick={() => toast("Draft salvo com sucesso na aba Drafts.")}>Salvar Draft</Button>
               <Button onClick={handleSubmit} disabled={isSubmitting} className="min-w-[140px]">
                 {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="mr-2 h-4 w-4" /> Enviar para a Fila</>}
               </Button>
            </div>
          </div>
        </Card>
      )}

      {step === 3 && (
        <Card className="p-12 bg-card border-border shadow-sm flex flex-col items-center justify-center gap-4 text-center animate-in zoom-in-95 duration-500">
          <div className="h-20 w-20 rounded-full bg-emerald-500/10 flex items-center justify-center mb-2">
             <Check className="h-10 w-10 text-emerald-500" />
          </div>
          <h2 className="text-3xl font-bold">Post Agendado!</h2>
          <p className="text-muted-foreground max-w-sm mt-2">O conteúdo foi validado e enviado para a fila de execução. O robô assumirá daqui em diante.</p>
          <div className="flex gap-4 mt-8">
             <Button variant="outline" onClick={() => { setStep(1); setSelectedSub(""); }}>Criar Novo Post</Button>
             <Link href="/jobs">
               <Button variant="default">Ver Fila de Execução</Button>
             </Link>
          </div>
        </Card>
      )}
    </div>
  );
}
