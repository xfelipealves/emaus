"use client";

import { CheckCircle2, Download, FileSpreadsheet, Upload } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { useAction } from "@/hooks/use-action";
import { guessMapping, IMPORT_FIELDS, type ImportField, parseCsv, toCsv } from "@/lib/csv";
import { cn } from "@/lib/utils";
import { importPeopleAction } from "../actions";

const TEMPLATE = toCsv([
  { "Nome completo": "Maria da Silva", Apelido: "Mari", Status: "Membro", Celular: "(11) 99999-0000", "E-mail": "maria@email.com", Nascimento: "15/03/1985", Sexo: "F", Família: "Família Silva", "Membro desde": "10/01/2020" },
  { "Nome completo": "João da Silva", Apelido: "", Status: "Membro", Celular: "(11) 98888-0000", "E-mail": "", Nascimento: "02/07/1983", Sexo: "M", Família: "Família Silva", "Membro desde": "10/01/2020" },
]);

export function Importer() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Partial<Record<ImportField, string>>>({});
  const [drag, setDrag] = useState(false);
  const run = useAction(importPeopleAction);
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof importPeopleAction>> | null>(null);

  async function load(file: File) {
    const text = await file.text();
    const parsed = parseCsv(text);
    setFileName(file.name);
    setHeaders(parsed.headers);
    setRows(parsed.rows);
    setMapping(guessMapping(parsed.headers));
    setSummary(null);
  }

  if (summary?.ok) {
    const s = summary.data;
    return (
      <div className="max-w-2xl rounded-2xl border bg-card p-6 shadow-xs">
        <CheckCircle2 className="size-8 text-success" />
        <h2 className="mt-3 font-display text-3xl">{s.created} pessoas importadas</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {s.households > 0 && `${s.households} famílias criadas. `}
          {s.skipped.length > 0 && `${s.skipped.length} linhas ignoradas.`}
        </p>
        {s.skipped.length > 0 && (
          <ul className="mt-4 max-h-60 divide-y overflow-y-auto rounded-xl border text-sm">
            {s.skipped.map((x) => (
              <li key={x.line} className="flex justify-between gap-3 px-3 py-2">
                <span>Linha {x.line}: {x.name}</span>
                <span className="text-muted-foreground">{x.reason}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-5 flex gap-2">
          <Button render={<Link href="/pessoas" />} nativeButton={false}>Ver pessoas</Button>
          <Button variant="outline" onClick={() => { setSummary(null); setRows([]); setFileName(null); }}>Importar outra</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-4">
        <label
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) load(f); }}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed bg-card px-6 py-12 text-center transition-colors",
            drag ? "border-primary bg-primary/5" : "hover:border-primary/50",
          )}
        >
          <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) load(f); }} />
          {fileName ? <FileSpreadsheet className="size-8 text-primary" /> : <Upload className="size-8 text-muted-foreground" />}
          <div className="font-medium">{fileName ?? "Arraste o arquivo CSV ou clique para escolher"}</div>
          <div className="text-sm text-muted-foreground">{fileName ? `${rows.length} linhas encontradas` : "Separado por vírgula ou ponto e vírgula, com cabeçalho na primeira linha."}</div>
        </label>

        {rows.length > 0 && (
          <div className="overflow-hidden rounded-2xl border bg-card shadow-xs">
            <div className="border-b px-4 py-3 text-sm font-medium">Prévia</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                  <tr>{(Object.keys(IMPORT_FIELDS) as ImportField[]).filter((f) => mapping[f]).map((f) => <th key={f} className="px-3 py-2 font-medium whitespace-nowrap">{IMPORT_FIELDS[f]}</th>)}</tr>
                </thead>
                <tbody className="divide-y">
                  {rows.slice(0, 5).map((r, i) => (
                    <tr key={i}>{(Object.keys(IMPORT_FIELDS) as ImportField[]).filter((f) => mapping[f]).map((f) => <td key={f} className="px-3 py-2 whitespace-nowrap">{r[mapping[f]!]}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <aside className="space-y-4">
        {headers.length > 0 ? (
          <div className="rounded-2xl border bg-card p-4 shadow-xs">
            <h2 className="text-sm font-semibold">Colunas</h2>
            <p className="mt-1 text-xs text-muted-foreground">Confira o que reconhecemos. Status em branco vira “Membro”.</p>
            <div className="mt-4 space-y-2.5">
              {(Object.keys(IMPORT_FIELDS) as ImportField[]).map((f) => (
                <div key={f} className="grid grid-cols-[8rem_1fr] items-center gap-3 text-sm">
                  <span className={cn(f === "fullName" && "font-medium")}>{IMPORT_FIELDS[f]}{f === "fullName" && " *"}</span>
                  <NativeSelect value={mapping[f] ?? ""} onChange={(e) => setMapping((m) => ({ ...m, [f]: e.target.value || undefined }))}>
                    <option value="">— ignorar —</option>
                    {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </NativeSelect>
                </div>
              ))}
            </div>
            <Button
              className="mt-5 w-full"
              size="lg"
              disabled={!mapping.fullName || run.pending}
              onClick={async () => setSummary(await run.run(rows, mapping))}
            >
              {run.pending ? <Spinner /> : `Importar ${rows.length} pessoas`}
            </Button>
          </div>
        ) : (
          <div className="rounded-2xl border bg-card p-4 text-sm shadow-xs">
            <h2 className="font-semibold">Dicas</h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-4 text-muted-foreground">
              <li>Pessoas com o mesmo nome ou celular já cadastrados são ignoradas.</li>
              <li>Datas no formato DD/MM/AAAA.</li>
              <li>A coluna “Família” agrupa pessoas da mesma casa automaticamente.</li>
            </ul>
            <Button
              variant="outline"
              className="mt-4 w-full"
              render={<a href={`data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE)}`} download="modelo-emaus.csv" />}
              nativeButton={false}
            >
              <Download data-icon="inline-start" /> Baixar modelo
            </Button>
          </div>
        )}
      </aside>
    </div>
  );
}
