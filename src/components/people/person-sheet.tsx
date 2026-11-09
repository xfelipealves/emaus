"use client";

import { useRouter } from "next/navigation";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PersonForm, type PersonFormValues } from "./person-form";

export function PersonSheet({
  open,
  onOpenChange,
  initial,
  households,
  navigateOnCreate = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: PersonFormValues;
  households: { id: string; name: string }[];
  navigateOnCreate?: boolean;
}) {
  const router = useRouter();
  const editing = !!initial?.id;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="font-display text-2xl font-normal">{editing ? "Editar cadastro" : "Nova pessoa"}</SheetTitle>
          <SheetDescription>
            {editing ? "Atualize os dados de contato e família." : "Só o nome é obrigatório. O resto pode ser completado depois."}
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-4">
          <PersonForm
            initial={initial}
            households={households}
            onDone={(id) => {
              onOpenChange(false);
              if (!editing && navigateOnCreate) router.push(`/pessoas/${id}`);
            }}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
