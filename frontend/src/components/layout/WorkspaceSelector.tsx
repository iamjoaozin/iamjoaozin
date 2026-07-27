"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const workspaces = [
  {
    value: "studio-joaozin",
    label: "Studio Joãozin",
  },
  {
    value: "personal-art",
    label: "Personal Art",
  },
];

export function WorkspaceSelector() {
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState("studio-joaozin");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        role="combobox"
        aria-expanded={open}
        className={cn(buttonVariants({ variant: "outline" }), "w-full justify-between font-semibold")}
      >
        {value
          ? workspaces.find((fw) => fw.value === value)?.label
          : "Select workspace..."}
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0">
        <Command>
          <CommandInput placeholder="Search workspace..." />
          <CommandList>
            <CommandEmpty>No workspace found.</CommandEmpty>
            <CommandGroup>
              {workspaces.map((fw) => (
                <CommandItem
                  key={fw.value}
                  value={fw.value}
                  onSelect={(currentValue) => {
                    setValue(currentValue === value ? "" : currentValue);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === fw.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {fw.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
