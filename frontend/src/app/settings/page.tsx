"use client";

import { useLayoutStore } from "@/store/layout.store";
import { useTheme } from "next-themes";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { sidebarCollapsed, toggleSidebar } = useLayoutStore();

  return (
    <div className="flex flex-col gap-6 max-w-4xl animate-in fade-in duration-500 h-full">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground mt-1">Gerencie suas preferências de interface e sistema.</p>
      </div>

      <div className="grid gap-6">
        <Card className="shadow-sm border-border">
          <CardHeader>
            <CardTitle>Aparência</CardTitle>
            <CardDescription>Personalize a interface do sistema.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
             <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                   <Label>Tema Visual</Label>
                   <p className="text-sm text-muted-foreground">Selecione o esquema de cores preferido.</p>
                </div>
                <Select value={theme} onValueChange={setTheme}>
                   <SelectTrigger className="w-[180px]">
                     <SelectValue placeholder="Selecione um tema" />
                   </SelectTrigger>
                   <SelectContent>
                     <SelectItem value="light">Claro</SelectItem>
                     <SelectItem value="dark">Escuro</SelectItem>
                     <SelectItem value="system">Sistema</SelectItem>
                   </SelectContent>
                </Select>
             </div>
             
             <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                   <Label>Recolher Sidebar</Label>
                   <p className="text-sm text-muted-foreground">Oculte o menu lateral por padrão.</p>
                </div>
                <Switch checked={sidebarCollapsed} onCheckedChange={toggleSidebar} />
             </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border">
          <CardHeader>
            <CardTitle>Regras Globais de Postagem</CardTitle>
            <CardDescription>Configurações padrão que afetam todas as automações.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
             <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                   <Label>Pausar em caso de falha</Label>
                   <p className="text-sm text-muted-foreground">Pausa o Subreddit automaticamente após 3 falhas seguidas.</p>
                </div>
                <Switch defaultChecked />
             </div>
          </CardContent>
        </Card>
        
        <div className="flex justify-end gap-4">
           <Button variant="outline">Restaurar Padrões</Button>
           <Button>Salvar Configurações</Button>
        </div>
      </div>
    </div>
  );
}
