#!/usr/bin/env node
/**
 * Extrai quem participa de cada ministério a partir dos grupos de WhatsApp da igreja
 * e grava `data/roster.json` (fora do git). O seed usa esse arquivo, quando existe,
 * para popular os ministérios com as pessoas reais.
 *
 * Fontes (somente leitura, copiadas para um diretório temporário):
 *   - WhatsApp Desktop (macOS): membros e administradores de cada grupo
 *   - nchat: nomes salvos na agenda, indexados pelo identificador do WhatsApp
 *
 * Não grava telefones nem mensagens: só nome, ministérios e função.
 *
 * Correções manuais ficam em `data/roster-overrides.json` (também fora do git):
 *   { "leaders": { "Homens de Honra": ["Nome Exato"] } }
 * define a liderança exata do ministério; os demais viram participantes.
 *
 *   node scripts/extract-whatsapp-roster.mjs [--nchat-profile <dir>]
 */
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

/** Grupo de WhatsApp (início do nome, sem acento/caixa) → ministério e função. */
const GROUPS = [
  { match: "ministerio de louvor", ministry: "Louvor" },
  { match: "midia ieq", ministry: "Mídia" },
  { match: "metanoia", ministry: "Metanoia", exact: true },
  { match: "supervisao", ministry: "Metanoia", role: "leader" },
  { match: "new mind", ministry: "New Mind", exact: true },
  { match: "lideranca new mind", ministry: "New Mind", role: "leader" },
  { match: "new song", ministry: "New Song" },
  { match: "homens de honra", ministry: "Homens de Honra" },
  { match: "homens ao maximo", ministry: "Homens de Honra" },
  { match: "casa de paz", ministry: "Casa de Paz" },
];

/** Rótulos de agenda que não fazem parte do nome. */
const NOISE = new Set(["ieq", "igreja", "bass", "baixo", "batera", "bateria", "teclado", "guitarra", "novo", "nova", "louvor", "midia"]);

const normalize = (s) =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^\p{L}\p{N} ]/gu, " ").replace(/\s+/g, " ").trim().toLowerCase();

function cleanName(raw) {
  if (!raw || !/\p{L}/u.test(raw)) return null;
  let words = raw
    .replace(/[^\p{L}\p{M}'. -]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => !NOISE.has(normalize(w)));
  if (!words.length) return null;
  // Pr / Pra / Prª → Pastor / Pastora
  const title = normalize(words[0]);
  if (["pr", "pastor"].includes(title)) words[0] = "Pastor";
  if (["pra", "pr a", "pastora"].includes(title) || words[0] === "Prª") words[0] = "Pastora";
  words = words.map((w) => (w === w.toUpperCase() && w.length > 2 ? w[0] + w.slice(1).toLowerCase() : w));
  return words.join(" ");
}

function snapshot(file, dir) {
  const target = join(dir, file.split("/").pop());
  copyFileSync(file, target);
  for (const ext of ["-wal", "-shm"]) if (existsSync(file + ext)) copyFileSync(file + ext, target + ext);
  return target;
}

const args = process.argv.slice(2);
const waDir = join(homedir(), "Library/Group Containers/group.net.whatsapp.WhatsApp.shared");
const nchatHistory = join(homedir(), ".config/nchat/history");
const profileArg = args.includes("--nchat-profile") ? args[args.indexOf("--nchat-profile") + 1] : null;
const profile = profileArg ?? (existsSync(nchatHistory) ? readdirSync(nchatHistory).find((d) => d.startsWith("WhatsApp")) : null);

if (!existsSync(join(waDir, "ChatStorage.sqlite"))) {
  console.error("WhatsApp Desktop não encontrado neste Mac.");
  process.exit(1);
}
if (!profile) {
  console.error("Perfil do nchat não encontrado (~/.config/nchat/history).");
  process.exit(1);
}

const tmp = mkdtempSync(join(tmpdir(), "emaus-roster-"));
try {
  const wa = new DatabaseSync(snapshot(join(waDir, "ChatStorage.sqlite"), tmp), { readOnly: true });
  const nchat = new DatabaseSync(snapshot(join(nchatHistory, profile, "db.sqlite"), tmp), { readOnly: true });

  const names = new Map(
    nchat.prepare("select id, name from contacts2 where name <> ''").all().map((r) => [r.id, r.name]),
  );
  const groups = wa
    .prepare("select Z_PK as id, ZPARTNERNAME as name from ZWACHATSESSION where ZCONTACTJID like '%@g.us'")
    .all();
  const members = wa.prepare("select ZMEMBERJID as jid, ZISADMIN as admin from ZWAGROUPMEMBER where ZCHATSESSION = ? and ZISACTIVE = 1");

  const people = new Map();
  const report = [];
  for (const rule of GROUPS) {
    const group = groups.find((g) => {
      const n = normalize(g.name ?? "");
      return rule.exact ? n === rule.match : n.startsWith(rule.match);
    });
    if (!group) {
      report.push(`  ✗ ${rule.match}: grupo não encontrado`);
      continue;
    }
    let named = 0;
    const rows = members.all(group.id);
    for (const m of rows) {
      const name = cleanName(names.get(m.jid));
      if (!name) continue;
      named++;
      const key = createHash("sha256").update(m.jid).digest("hex").slice(0, 16);
      const person = people.get(key) ?? { key, name, memberships: {} };
      const role = rule.role ?? (m.admin ? "leader" : "member");
      // Liderança vence participação no mesmo ministério.
      if (person.memberships[rule.ministry] !== "leader") person.memberships[rule.ministry] = role;
      people.set(key, person);
    }
    report.push(`  ✓ ${group.name.trim()} → ${rule.ministry}${rule.role ? " (liderança)" : ""}: ${named}/${rows.length} com nome`);
  }

  const overrides = existsSync("data/roster-overrides.json")
    ? JSON.parse(readFileSync("data/roster-overrides.json", "utf8"))
    : {};
  for (const [ministry, leaders] of Object.entries(overrides.leaders ?? {})) {
    for (const person of people.values()) {
      if (person.memberships[ministry]) person.memberships[ministry] = leaders.includes(person.name) ? "leader" : "member";
    }
    report.push(`  ✎ ${ministry}: liderança definida manualmente (${leaders.join(", ")})`);
  }

  const roster = [...people.values()]
    .map((p) => ({ ...p, memberships: Object.entries(p.memberships).map(([ministry, role]) => ({ ministry, role })) }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  mkdirSync("data", { recursive: true });
  writeFileSync("data/roster.json", JSON.stringify({ generatedAt: new Date().toISOString(), people: roster }, null, 2));
  console.log(report.join("\n"));
  console.log(`\n${roster.length} pessoas com nome gravadas em data/roster.json (sem telefones).`);
  console.log("Quem não tem nome salvo na agenda fica de fora: salve o contato e rode de novo.");
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
