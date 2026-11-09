"use client";

import { MoreHorizontal, Pencil, Pin, PinOff, Send, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/hooks/use-action";
import { addNoteAction, deleteNoteAction, editNoteAction, toggleNotePinAction } from "@/app/(app)/pessoas/actions";

export function NoteComposer({ personId, firstName }: { personId: string; firstName: string }) {
  const [text, setText] = useState("");
  const add = useAction(addNoteAction, { onSuccess: () => setText("") });
  return (
    <form
      className="rounded-2xl border bg-card p-3 shadow-xs focus-within:ring-3 focus-within:ring-ring/30"
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim()) add.run(personId, text);
      }}
    >
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && text.trim()) add.run(personId, text);
        }}
        placeholder={`Anotação sobre ${firstName}: conversa, pedido de oração, visita…`}
        rows={2}
        className="min-h-16 resize-none border-0 bg-transparent! p-1 shadow-none focus-visible:ring-0"
      />
      <div className="flex items-center justify-between pt-2">
        <span className="text-xs text-muted-foreground">Visível para quem acompanha esta pessoa · ⌘↵ para salvar</span>
        <Button type="submit" size="sm" disabled={add.pending || !text.trim()}>
          {add.pending ? <Spinner /> : <><Send data-icon="inline-start" /> Salvar</>}
        </Button>
      </div>
    </form>
  );
}

export function NoteMenu({ id, content, pinned, canEdit }: { id: string; content: string; pinned: boolean; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(content);
  const pin = useAction(toggleNotePinAction);
  const edit = useAction(editNoteAction, { onSuccess: () => setEditing(false) });
  const remove = useAction(deleteNoteAction);

  if (editing) {
    return (
      <div className="mt-2 space-y-2">
        <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} autoFocus />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancelar</Button>
          <Button size="sm" disabled={edit.pending} onClick={() => edit.run(id, text)}>Salvar</Button>
        </div>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-xs" aria-label="Ações da anotação" className="absolute top-3 right-3" />}>
        <MoreHorizontal />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => pin.run(id)}>{pinned ? <><PinOff /> Desafixar</> : <><Pin /> Fixar no topo</>}</DropdownMenuItem>
        {canEdit && <DropdownMenuItem onClick={() => setEditing(true)}><Pencil /> Editar</DropdownMenuItem>}
        {canEdit && <DropdownMenuItem variant="destructive" onClick={() => remove.run(id)}><Trash2 /> Excluir</DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
