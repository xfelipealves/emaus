"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, Input } from "@/components/ui";
import { archiveNoteAction, saveNoteAction, type NoteActionState } from "./notes-actions";
import type { NoteFilter, PersonNote } from "@/features/timeline/note-service";

export function Notes({ personId, notes, filter }: { personId: string; notes: PersonNote[]; filter: NoteFilter }) {
  const [state, formAction, isPending] = useActionState<NoteActionState, FormData>(saveNoteAction, {});
  const [archiveState, archiveFormAction, isArchivePending] = useActionState<NoteActionState, FormData>(archiveNoteAction, {});

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[#26766d]">Acompanhamento</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">Notas</h2>
        </div>
        <nav aria-label="Filtros de notas" className="flex gap-2 text-xs font-semibold">
          <Link href={`/pessoas/${personId}`} className={filter === "active" ? "text-[#155e58]" : "text-slate-500 hover:text-slate-700"}>Ativas</Link>
          <Link href={`/pessoas/${personId}?notes=archived`} className={filter === "archived" ? "text-[#155e58]" : "text-slate-500 hover:text-slate-700"}>Arquivadas</Link>
        </nav>
      </div>
      <div className="mt-5 grid gap-4">
        {notes.map((note) => (
          <div key={note.id} className="grid gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
            <form action={formAction} className="grid gap-3">
              <input type="hidden" name="personId" value={personId} />
              <input type="hidden" name="noteId" value={note.id} />
              <label htmlFor={`note-${note.id}`} className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nota</label>
              <textarea id={`note-${note.id}`} name="content" defaultValue={note.content} rows={3} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#26766d] focus:ring-2 focus:ring-[#26766d]/20" />
              <div className="flex justify-end"><Button type="submit" variant="secondary" disabled={isPending}>{isPending ? "Salvando..." : "Salvar edição"}</Button></div>
            </form>
            {filter === "active" ? <form action={archiveFormAction} onSubmit={(event) => { if (!window.confirm("Arquivar esta nota?")) event.preventDefault(); }} className="flex justify-end"><input type="hidden" name="personId" value={personId} /><input type="hidden" name="noteId" value={note.id} /><Button type="submit" variant="secondary" disabled={isArchivePending}>Arquivar</Button></form> : null}
          </div>
        ))}
        <form action={formAction} className="grid gap-3 border-t border-slate-100 pt-4">
          <input type="hidden" name="personId" value={personId} />
          <Input id="new-note" name="content" label="Nova nota" required />
          <div className="flex justify-end"><Button type="submit" disabled={isPending}>{isPending ? "Salvando..." : "Adicionar nota"}</Button></div>
        </form>
      </div>
      {state.error || archiveState.error ? <p role="alert" className="mt-4 rounded-xl bg-[#fff1f1] px-3 py-2 text-sm text-[#b54747]">{state.error ?? archiveState.error}</p> : null}
      {state.success || archiveState.success ? <p role="status" className="mt-4 rounded-xl bg-[#e3f1ed] px-3 py-2 text-sm text-[#155e58]">{state.success ?? archiveState.success}</p> : null}
    </section>
  );
}
