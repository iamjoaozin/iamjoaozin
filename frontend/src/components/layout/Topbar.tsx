"use client";

import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function Topbar() {
  return (
    <header className="h-16 border-b border-border bg-background flex items-center justify-between px-6 shrink-0">
      <div className="flex-1">
        {/* Breadcrumbs renderizados condicionalmente aqui no futuro */}
      </div>
      
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5 text-muted-foreground" />
          <span className="absolute top-1.5 right-2 h-2 w-2 rounded-full bg-destructive" />
        </Button>

        <Avatar className="h-8 w-8 cursor-pointer">
          <AvatarImage src="https://github.com/shadcn.png" alt="@user" />
          <AvatarFallback>UI</AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
