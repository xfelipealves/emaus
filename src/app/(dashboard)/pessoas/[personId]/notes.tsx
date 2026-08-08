"use client";

import { useActionState } from "react";
import { Button, Input } from "@/components/ui";
import { saveNoteAction, type NoteActionState } from "./notes-actions";
import type { PersonNote } from "@/features/timeline/note-service";

export function Notes({ personId, notes }: { personId: string; notes: PersonNote[] }) {
  const [state, formAction, isPending] = useActionState<NoteActionState, FormData>(saveNoteAction, {});

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[#26766d]">Acompanhamento</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">Notas</h2>
        </div>
        <span className="text-xs text-slate-500">{notes.length} {notes.length === 1 ? "nota" : "notas"}</span>
      </div>
      <div className="mt-5 grid gap-4">
        {notes.map((note) => (
          <form key={note.id} action={formAction} className="grid gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
            <input type="hidden" name="personId" value={personId} />
            <input type="hidden" name="noteId" value={note.id} />
            <label htmlFor={`note-${note.id}`} className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nota</label>
            <textarea id={`note-${note.id}`} name="content" defaultValue={note.content} rows={3} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#26766d] focus:ring-2 focus:ring-[#26766d]/20" />
            <div className="flex justify-end"><Button type="submit" variant="secondary" disabled={isPending}>{isPending ? "Salvando..." : "Salvar edição"}</Button></div>
          </form>
        ))}
        <form action={formAction} className="grid gap-3 border-t border-slate-100 pt-4">
          <input type="hidden" name="personId" value={personId} />
          <Input id="new-note" name="content" label="Nova nota" required />
          <div className="flex justify-end"><Button type="submit" disabled={isPending}>{isPending ? "Salvando..." : "Adicionar nota"}</Button></div>
        </form>
      </div>
      {state.error ? <p role="alert" className="mt-4 rounded-xl bg-[#fff1f1] px-3 py-2 text-sm text-[#b54747]">{state.error}</p> : null}
      {state.success ? <p role="status" className="mt-4 rounded-xl bg-[#e3f1ed] px-3 py-2 text-sm text-[#155e58]">{state.success}</p> : null}
    </section>
  );
}
