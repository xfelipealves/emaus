"use client";

import { useState, type FormEvent } from "react";
import type { AttendanceStatus } from "@prisma/client";
import { addAttendancePersonAction, addQuickVisitorAction, cycleAttendanceAction, searchAttendanceAction } from "./actions";
import { summarizeAttendance } from "@/features/encontros/attendance-query";

type Row = { id: string; status: AttendanceStatus; person: { fullName: string } };

const statusLabel: Record<AttendanceStatus, string> = {
  NOT_CONFIRMED: "Não confirmado",
  PRESENT: "Presente",
  ABSENT: "Ausente",
};

const statusClasses: Record<AttendanceStatus, string> = {
  NOT_CONFIRMED: "border-slate-200 bg-white text-slate-700",
  PRESENT: "border-[#b9ded5] bg-[#effaf7] text-[#155e58]",
  ABSENT: "border-[#ecc3c3] bg-[#fff5f5] text-[#963b3b]",
};

export function AttendanceBoard({ rows, meetingId }: { rows: Row[]; meetingId: string }) {
  const [items, setItems] = useState(rows);
  const [reason, setReason] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [retryRowId, setRetryRowId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Array<{ id: string; fullName: string }>>([]);
  const [visitorName, setVisitorName] = useState("");
  const summary = summarizeAttendance(items);

  async function cycle(row: Row) {
    if (savingId) return;
    const previous = row.status;
    const optimistic = previous === "NOT_CONFIRMED" ? "PRESENT" : previous === "PRESENT" ? "ABSENT" : "NOT_CONFIRMED";
    setItems((current) => current.map((item) => item.id === row.id ? { ...item, status: optimistic } : item));
    setSavingId(row.id);
    setRetryRowId(null);
    setFeedback(null);
    const result = await cycleAttendanceAction(row.id, reason);
    setSavingId(null);
    if (result.error || !result.status) {
      setItems((current) => current.map((item) => item.id === row.id ? { ...item, status: previous } : item));
      setRetryRowId(row.id);
      setFeedback(result.error ?? "Não foi possível salvar a presença.");
      return;
    }
    setItems((current) => current.map((item) => item.id === row.id ? { ...item, status: result.status! } : item));
    setRetryRowId(null);
    setFeedback("Presença salva.");
  }

  function retry() {
    const row = items.find((item) => item.id === retryRowId);
    if (row) void cycle(row);
  }

  async function findPeople() {
    const result = await searchAttendanceAction(meetingId, search);
    setResults(result.people ?? []);
    setFeedback(result.error ?? null);
  }

  async function addPerson(personId: string) {
    const result = await addAttendancePersonAction(meetingId, personId);
    if (result.error) {
      setFeedback(result.error);
      return;
    }
    setItems((current) => [...current, { id: result.attendanceId!, status: result.status!, person: { fullName: result.personName! } }]);
    setResults((current) => current.filter((person) => person.id !== personId));
    setFeedback("Pessoa adicionada.");
  }

  async function addVisitor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await addQuickVisitorAction(meetingId, visitorName);
    if (result.error) {
      setFeedback(result.error);
      return;
    }
    setVisitorName("");
    setItems((current) => [...current, { id: result.attendanceId!, status: result.status!, person: { fullName: result.personName! } }]);
    setFeedback("Visitante adicionado.");
  }

  return <div className="grid gap-5"><div className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-4"><h2 className="font-semibold text-slate-950">Resumo</h2><p className="text-sm text-slate-600">Não confirmados: {summary.NOT_CONFIRMED} · Presentes: {summary.PRESENT} · Ausentes: {summary.ABSENT}</p></div><div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4"><h2 className="font-semibold text-slate-950">Adicionar Pessoa</h2><div className="flex gap-2"><input aria-label="Buscar Pessoa" value={search} onChange={(event) => setSearch(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-[#26766d]" placeholder="Nome da Pessoa" /><button type="button" onClick={findPeople} className="rounded-xl bg-[#26766d] px-4 py-2 text-sm font-semibold text-white">Buscar</button></div>{results.map((person) => <button key={person.id} type="button" onClick={() => addPerson(person.id)} className="rounded-xl border border-slate-200 px-3 py-2 text-left text-sm font-medium text-slate-700">Adicionar {person.fullName}</button>)}<form onSubmit={addVisitor} className="flex gap-2 border-t border-slate-100 pt-3"><input aria-label="Nome do visitante rápido" value={visitorName} onChange={(event) => setVisitorName(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-[#26766d]" placeholder="Visitante rápido" required /><button type="submit" className="rounded-xl border border-[#26766d] px-4 py-2 text-sm font-semibold text-[#26766d]">Adicionar visitante</button></form></div><label className="grid gap-2 text-sm font-medium text-slate-700" htmlFor="attendance-reason">Motivo opcional da correção<textarea id="attendance-reason" value={reason} onChange={(event) => setReason(event.target.value)} className="min-h-20 rounded-xl border border-slate-200 px-3 py-2 font-normal outline-none focus:border-[#26766d]" /></label>{feedback ? <div className="flex flex-wrap items-center gap-3"><p role="status" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">{feedback}</p>{retryRowId ? <button type="button" onClick={retry} className="rounded-xl border border-[#26766d] px-4 py-3 text-sm font-semibold text-[#26766d]">Tentar novamente</button> : null}</div> : null}<div className="grid gap-3">{items.map((row) => <button key={row.id} type="button" aria-label={`Marcar ${row.person.fullName}`} disabled={savingId !== null} onClick={() => cycle(row)} className={`flex min-h-16 items-center justify-between rounded-2xl border px-4 text-left transition ${statusClasses[row.status]}`}><span className="font-semibold">{row.person.fullName}</span><span className="text-sm font-medium">{statusLabel[row.status]}</span></button>)}</div></div>;
}
