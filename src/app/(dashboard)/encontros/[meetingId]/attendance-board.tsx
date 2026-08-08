"use client";

import { useState } from "react";
import type { AttendanceStatus } from "@prisma/client";
import { cycleAttendanceAction } from "./actions";

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

export function AttendanceBoard({ rows }: { rows: Row[] }) {
  const [items, setItems] = useState(rows);
  const [reason, setReason] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function cycle(row: Row) {
    if (savingId) return;
    const previous = row.status;
    const optimistic = previous === "NOT_CONFIRMED" ? "PRESENT" : previous === "PRESENT" ? "ABSENT" : "NOT_CONFIRMED";
    setItems((current) => current.map((item) => item.id === row.id ? { ...item, status: optimistic } : item));
    setSavingId(row.id);
    setFeedback(null);
    const result = await cycleAttendanceAction(row.id, reason);
    setSavingId(null);
    if (result.error || !result.status) {
      setItems((current) => current.map((item) => item.id === row.id ? { ...item, status: previous } : item));
      setFeedback(result.error ?? "Não foi possível salvar a presença.");
      return;
    }
    setItems((current) => current.map((item) => item.id === row.id ? { ...item, status: result.status! } : item));
    setFeedback("Presença salva.");
  }

  return <div className="grid gap-5"><label className="grid gap-2 text-sm font-medium text-slate-700" htmlFor="attendance-reason">Motivo opcional da correção<textarea id="attendance-reason" value={reason} onChange={(event) => setReason(event.target.value)} className="min-h-20 rounded-xl border border-slate-200 px-3 py-2 font-normal outline-none focus:border-[#26766d]" /></label>{feedback ? <p role="status" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">{feedback}</p> : null}<div className="grid gap-3">{items.map((row) => <button key={row.id} type="button" aria-label={`Marcar ${row.person.fullName}`} disabled={savingId !== null} onClick={() => cycle(row)} className={`flex min-h-16 items-center justify-between rounded-2xl border px-4 text-left transition ${statusClasses[row.status]}`}><span className="font-semibold">{row.person.fullName}</span><span className="text-sm font-medium">{statusLabel[row.status]}</span></button>)}</div></div>;
}
