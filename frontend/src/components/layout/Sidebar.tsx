"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, PenSquare, Grid, Image as ImageIcon, CheckSquare, List, History, Settings, TerminalSquare } from "lucide-react";
import { WorkspaceSelector } from "./WorkspaceSelector";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Criar Post", href: "/post", icon: PenSquare },
  { name: "Subreddits", href: "/subreddits", icon: List },
  { name: "Imagens", href: "/images", icon: ImageIcon },
  { name: "Templates", href: "/templates", icon: Grid },
  { name: "Drafts", href: "/drafts", icon: CheckSquare },
  { name: "Execution Jobs", href: "/jobs", icon: TerminalSquare },
  { name: "Histórico", href: "/history", icon: History },
  { name: "Logs", href: "/logs", icon: TerminalSquare },
  { name: "Configurações", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r border-border bg-card flex flex-col h-full shrink-0">
      <div className="p-4 border-b border-border">
        <WorkspaceSelector />
      </div>
      <nav className="flex-1 overflow-y-auto p-4 space-y-1">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                isActive 
                  ? "bg-primary/10 text-primary" 
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-border text-xs text-muted-foreground text-center">
        Cmd+K para buscar
      </div>
    </aside>
  );
}
