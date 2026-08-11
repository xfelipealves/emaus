import { Prisma, PrismaClient } from "@prisma/client";

export const seedPrisma = new PrismaClient();

// Replaced by the Argon2 service in T11; this seed never stores the development password.
export const DEVELOPMENT_PASSWORD_HASH =
  "$argon2id$v=19$m=65536,t=3,p=4$ZW1hdXMtZGV2LXNlZWQ$ZGV2ZWxvcG1lbnQtaGFzaA";

export const DEMO_PASSWORD = "emaus-demo";
export const DEMO_PASSWORD_HASH =
  "$argon2id$v=19$m=65536,t=3,p=4$FkfLNDeqYckydzxUqw8BBw$vL0egV2q39FKcEB/oPW3JET9BAWlkQG/mGo99p1b+fQ";

export const DEMO_SCENARIO_IDS = {
  accounts: {
    administrator: "demo-account-administrator",
    secretary: "demo-account-secretary",
    leader: "demo-account-leader",
  },
  people: {
    administrator: "demo-person-administrator",
    secretary: "demo-person-secretary",
    leader: "demo-person-leader",
    member: "demo-person-member",
    visitor: "demo-person-visitor",
    inactive: "demo-person-inactive",
    otherMinistry: "demo-person-other-ministry",
  },
  ministries: {
    welcome: "demo-ministry-welcome",
    music: "demo-ministry-music",
    archived: "demo-ministry-archived",
  },
  category: "demo-category-community",
  series: "demo-series-community",
  meetings: {
    scheduled: "demo-meeting-scheduled",
    cancelled: "demo-meeting-cancelled",
  },
  attendances: {
    leader: "demo-attendance-leader",
    member: "demo-attendance-member",
    visitor: "demo-attendance-visitor",
  },
  notes: {
    active: "demo-note-active",
    archived: "demo-note-archived",
  },
  timeline: {
    registration: "demo-timeline-registration",
    attendance: "demo-timeline-attendance",
    note: "demo-timeline-note",
    correction: "demo-timeline-correction",
  },
  audit: {
    attendance: "demo-audit-attendance",
    person: "demo-audit-person",
  },
} as const;

function utc(value: string) {
  return new Date(value);
}

async function seedDemoScenario() {
  const demoPasswordHash = DEMO_PASSWORD_HASH;

  const people = [
    {
      id: DEMO_SCENARIO_IDS.people.administrator,
      fullName: "Demo Administrador",
      status: "MEMBER" as const,
      phone: "(00) 00000-0001",
      birthDate: utc("1985-02-10T00:00:00.000Z"),
    },
    {
      id: DEMO_SCENARIO_IDS.people.secretary,
      fullName: "Demo Secretária",
      status: "MEMBER" as const,
      phone: "(00) 00000-0002",
      birthDate: utc("1988-04-12T00:00:00.000Z"),
    },
    {
      id: DEMO_SCENARIO_IDS.people.leader,
      fullName: "Demo Líder",
      status: "MEMBER" as const,
      phone: "(00) 00000-0003",
      birthDate: utc("1982-06-18T00:00:00.000Z"),
    },
    {
      id: DEMO_SCENARIO_IDS.people.member,
      fullName: "Demo Membro",
      status: "MEMBER" as const,
      phone: "(00) 00000-0004",
      birthDate: utc("1990-08-22T00:00:00.000Z"),
    },
    {
      id: DEMO_SCENARIO_IDS.people.visitor,
      fullName: "Demo Visitante",
      status: "VISITOR" as const,
      phone: null,
      birthDate: null,
    },
    {
      id: DEMO_SCENARIO_IDS.people.inactive,
      fullName: "Demo Pessoa Inativa",
      status: "INACTIVE" as const,
      phone: "(00) 00000-0005",
      birthDate: utc("1979-11-03T00:00:00.000Z"),
    },
    {
      id: DEMO_SCENARIO_IDS.people.otherMinistry,
      fullName: "Demo Pessoa de Música",
      status: "MEMBER" as const,
      phone: "(00) 00000-0006",
      birthDate: utc("1994-09-27T00:00:00.000Z"),
    },
  ];

  for (const person of people) {
    await seedPrisma.person.upsert({
      where: { id: person.id },
      create: person,
      update: person,
    });
  }

  const accounts = [
    {
      id: DEMO_SCENARIO_IDS.accounts.administrator,
      personId: DEMO_SCENARIO_IDS.people.administrator,
      username: "demo-admin",
      email: "admin@emaus.test",
      role: "ADMINISTRATOR" as const,
    },
    {
      id: DEMO_SCENARIO_IDS.accounts.secretary,
      personId: DEMO_SCENARIO_IDS.people.secretary,
      username: "demo-secretary",
      email: "secretary@emaus.test",
      role: "SECRETARY" as const,
    },
    {
      id: DEMO_SCENARIO_IDS.accounts.leader,
      personId: DEMO_SCENARIO_IDS.people.leader,
      username: "demo-leader",
      email: "leader@emaus.test",
      role: "LEADER" as const,
    },
  ];

  for (const account of accounts) {
    await seedPrisma.account.upsert({
      where: { id: account.id },
      create: { ...account, passwordHash: demoPasswordHash, status: "ACTIVE" },
      update: { ...account, passwordHash: demoPasswordHash, status: "ACTIVE" },
    });
  }

  const ministries = [
    {
      id: DEMO_SCENARIO_IDS.ministries.welcome,
      name: "Demo Acolhimento",
      description: "Ministério sintético para demonstrar escopo de liderança.",
      status: "ACTIVE" as const,
    },
    {
      id: DEMO_SCENARIO_IDS.ministries.music,
      name: "Demo Música",
      description: "Ministério sintético fora do escopo do líder demo.",
      status: "ACTIVE" as const,
    },
    {
      id: DEMO_SCENARIO_IDS.ministries.archived,
      name: "Demo Ministério Arquivado",
      description: "Ministério sintético preservado como histórico.",
      status: "ARCHIVED" as const,
    },
  ];

  for (const ministry of ministries) {
    await seedPrisma.ministry.upsert({
      where: { id: ministry.id },
      create: ministry,
      update: ministry,
    });
  }

  const memberships = [
    {
      id: "demo-membership-leader",
      personId: DEMO_SCENARIO_IDS.people.leader,
      ministryId: DEMO_SCENARIO_IDS.ministries.welcome,
      role: "LEADER" as const,
      startDate: utc("2026-01-01T00:00:00.000Z"),
      endDate: null,
    },
    {
      id: "demo-membership-member",
      personId: DEMO_SCENARIO_IDS.people.member,
      ministryId: DEMO_SCENARIO_IDS.ministries.welcome,
      role: "MEMBER" as const,
      startDate: utc("2026-01-01T00:00:00.000Z"),
      endDate: null,
    },
    {
      id: "demo-membership-other-ministry",
      personId: DEMO_SCENARIO_IDS.people.otherMinistry,
      ministryId: DEMO_SCENARIO_IDS.ministries.music,
      role: "MEMBER" as const,
      startDate: utc("2026-02-01T00:00:00.000Z"),
      endDate: null,
    },
    {
      id: "demo-membership-inactive",
      personId: DEMO_SCENARIO_IDS.people.inactive,
      ministryId: DEMO_SCENARIO_IDS.ministries.welcome,
      role: "MEMBER" as const,
      startDate: utc("2025-01-01T00:00:00.000Z"),
      endDate: utc("2026-06-30T00:00:00.000Z"),
    },
  ];

  for (const membership of memberships) {
    await seedPrisma.ministryMembership.upsert({
      where: { id: membership.id },
      create: membership,
      update: membership,
    });
  }

  await seedPrisma.accountMinistryAccess.upsert({
    where: {
      accountId_ministryId: {
        accountId: DEMO_SCENARIO_IDS.accounts.leader,
        ministryId: DEMO_SCENARIO_IDS.ministries.welcome,
      },
    },
    create: {
      id: "demo-access-leader-welcome",
      accountId: DEMO_SCENARIO_IDS.accounts.leader,
      ministryId: DEMO_SCENARIO_IDS.ministries.welcome,
      revokedAt: null,
    },
    update: { revokedAt: null },
  });

  await seedPrisma.category.upsert({
    where: { id: DEMO_SCENARIO_IDS.category },
    create: {
      id: DEMO_SCENARIO_IDS.category,
      name: "Demo Encontros",
      description: "Categoria sintética para demonstração local.",
    },
    update: {
      name: "Demo Encontros",
      description: "Categoria sintética para demonstração local.",
    },
  });

  await seedPrisma.meetingSeries.upsert({
    where: { id: DEMO_SCENARIO_IDS.series },
    create: {
      id: DEMO_SCENARIO_IDS.series,
      categoryId: DEMO_SCENARIO_IDS.category,
      name: "Demo Encontro Semanal",
      recurrence: "WEEKLY",
      weekdays: [6],
      startDate: utc("2026-08-01T00:00:00.000Z"),
      endDate: utc("2026-12-19T00:00:00.000Z"),
    },
    update: {
      categoryId: DEMO_SCENARIO_IDS.category,
      name: "Demo Encontro Semanal",
      recurrence: "WEEKLY",
      weekdays: [6],
      startDate: utc("2026-08-01T00:00:00.000Z"),
      endDate: utc("2026-12-19T00:00:00.000Z"),
    },
  });

  const meetings = [
    {
      id: DEMO_SCENARIO_IDS.meetings.scheduled,
      title: "Demo Encontro de Comunidade",
      scheduledAt: utc("2026-08-15T22:00:00.000Z"),
      status: "SCHEDULED" as const,
    },
    {
      id: DEMO_SCENARIO_IDS.meetings.cancelled,
      title: "Demo Encontro Cancelado",
      scheduledAt: utc("2026-08-22T22:00:00.000Z"),
      status: "CANCELLED" as const,
    },
  ];

  for (const meeting of meetings) {
    await seedPrisma.meeting.upsert({
      where: { id: meeting.id },
      create: { ...meeting, categoryId: DEMO_SCENARIO_IDS.category, seriesId: DEMO_SCENARIO_IDS.series },
      update: { ...meeting, categoryId: DEMO_SCENARIO_IDS.category, seriesId: DEMO_SCENARIO_IDS.series },
    });
  }

  await seedPrisma.meetingAudience.upsert({
    where: {
      meetingId_ministryId: {
        meetingId: DEMO_SCENARIO_IDS.meetings.scheduled,
        ministryId: DEMO_SCENARIO_IDS.ministries.welcome,
      },
    },
    create: {
      id: "demo-audience-scheduled-welcome",
      meetingId: DEMO_SCENARIO_IDS.meetings.scheduled,
      ministryId: DEMO_SCENARIO_IDS.ministries.welcome,
    },
    update: {},
  });

  const attendances = [
    {
      id: DEMO_SCENARIO_IDS.attendances.leader,
      meetingId: DEMO_SCENARIO_IDS.meetings.scheduled,
      personId: DEMO_SCENARIO_IDS.people.leader,
      status: "PRESENT" as const,
    },
    {
      id: DEMO_SCENARIO_IDS.attendances.member,
      meetingId: DEMO_SCENARIO_IDS.meetings.scheduled,
      personId: DEMO_SCENARIO_IDS.people.member,
      status: "PRESENT" as const,
    },
    {
      id: DEMO_SCENARIO_IDS.attendances.visitor,
      meetingId: DEMO_SCENARIO_IDS.meetings.scheduled,
      personId: DEMO_SCENARIO_IDS.people.visitor,
      status: "NOT_CONFIRMED" as const,
    },
  ];

  for (const attendance of attendances) {
    await seedPrisma.attendance.upsert({
      where: { id: attendance.id },
      create: attendance,
      update: { status: attendance.status },
    });
  }

  const notes = [
    {
      id: DEMO_SCENARIO_IDS.notes.active,
      content: "Demo: acompanhamento inicial",
      archived: false,
    },
    {
      id: DEMO_SCENARIO_IDS.notes.archived,
      content: "Demo: registro arquivado",
      archived: true,
    },
  ];

  for (const note of notes) {
    await seedPrisma.note.upsert({
      where: { id: note.id },
      create: {
        ...note,
        personId: DEMO_SCENARIO_IDS.people.member,
        authorId: DEMO_SCENARIO_IDS.accounts.administrator,
      },
      update: {
        ...note,
        personId: DEMO_SCENARIO_IDS.people.member,
        authorId: DEMO_SCENARIO_IDS.accounts.administrator,
      },
    });
    await seedPrisma.noteVersion.upsert({
      where: { id: `${note.id}-version-1` },
      create: {
        id: `${note.id}-version-1`,
        noteId: note.id,
        authorId: DEMO_SCENARIO_IDS.accounts.administrator,
        content: note.content,
        sequence: 1,
      },
      update: {
        authorId: DEMO_SCENARIO_IDS.accounts.administrator,
        content: note.content,
        sequence: 1,
      },
    });
  }

  const timelineEvents = [
    {
      id: DEMO_SCENARIO_IDS.timeline.registration,
      category: "REGISTRATION" as const,
      title: "Pessoa demo cadastrada",
      description: "Registro sintético de demonstração.",
      occurredAt: utc("2026-08-01T12:00:00.000Z"),
    },
    {
      id: DEMO_SCENARIO_IDS.timeline.attendance,
      category: "ATTENDANCE" as const,
      title: "Presença demo lançada",
      description: "Demo Encontro de Comunidade: NOT_CONFIRMED → PRESENT",
      occurredAt: utc("2026-08-08T22:00:00.000Z"),
    },
    {
      id: DEMO_SCENARIO_IDS.timeline.note,
      category: "NOTE" as const,
      title: "Nota demo adicionada",
      description: "Acompanhamento inicial.",
      occurredAt: utc("2026-08-08T23:00:00.000Z"),
    },
    {
      id: DEMO_SCENARIO_IDS.timeline.correction,
      category: "CORRECTION" as const,
      title: "Correção demo registrada",
      description: "Exemplo sintético de correção auditável.",
      occurredAt: utc("2026-08-09T00:00:00.000Z"),
    },
  ];

  for (const event of timelineEvents) {
    await seedPrisma.timelineEvent.upsert({
      where: { id: event.id },
      create: { ...event, personId: DEMO_SCENARIO_IDS.people.member },
      update: { ...event, personId: DEMO_SCENARIO_IDS.people.member },
    });
  }

  await seedPrisma.auditEvent.upsert({
    where: { id: DEMO_SCENARIO_IDS.audit.attendance },
    create: {
      id: DEMO_SCENARIO_IDS.audit.attendance,
      actorId: DEMO_SCENARIO_IDS.accounts.administrator,
      targetType: "Attendance",
      targetId: DEMO_SCENARIO_IDS.attendances.member,
      action: "UPDATE",
      before: { status: "NOT_CONFIRMED" },
      after: { status: "PRESENT" },
      reason: "Demo: conferência de lançamento",
    },
    update: {
      actorId: DEMO_SCENARIO_IDS.accounts.administrator,
      targetType: "Attendance",
      targetId: DEMO_SCENARIO_IDS.attendances.member,
      action: "UPDATE",
      before: { status: "NOT_CONFIRMED" },
      after: { status: "PRESENT" },
      reason: "Demo: conferência de lançamento",
    },
  });
  await seedPrisma.auditEvent.upsert({
    where: { id: DEMO_SCENARIO_IDS.audit.person },
    create: {
      id: DEMO_SCENARIO_IDS.audit.person,
      actorId: DEMO_SCENARIO_IDS.accounts.administrator,
      targetType: "Person",
      targetId: DEMO_SCENARIO_IDS.people.visitor,
      action: "CREATE",
      before: Prisma.JsonNull,
      after: { status: "VISITOR", source: "demo-seed" },
    },
    update: {
      actorId: DEMO_SCENARIO_IDS.accounts.administrator,
      targetType: "Person",
      targetId: DEMO_SCENARIO_IDS.people.visitor,
      action: "CREATE",
      before: Prisma.JsonNull,
      after: { status: "VISITOR", source: "demo-seed" },
    },
  });
}

export async function seed() {
  const account = await seedPrisma.account.upsert({
    where: { username: "admin" },
    create: {
      username: "admin",
      email: "admin@emaus.local",
      passwordHash: DEVELOPMENT_PASSWORD_HASH,
      role: "ADMINISTRATOR",
      person: {
        create: {
          fullName: "Administrador de Desenvolvimento",
          status: "MEMBER",
          phone: "(00) 00000-0000",
          birthDate: new Date("1990-01-01T00:00:00.000Z"),
        },
      },
    },
    update: {
      email: "admin@emaus.local",
      passwordHash: DEVELOPMENT_PASSWORD_HASH,
      role: "ADMINISTRATOR",
      status: "ACTIVE",
      person: {
        update: {
          fullName: "Administrador de Desenvolvimento",
          status: "MEMBER",
          phone: "(00) 00000-0000",
          birthDate: new Date("1990-01-01T00:00:00.000Z"),
        },
      },
    },
    include: { person: true },
  });

  await seedDemoScenario();
  return account;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seed()
    .then((account) => {
      console.log(`Seeded development administrator: ${account.username}`);
      console.log(`Seeded demo accounts with password: ${DEMO_PASSWORD}`);
    })
    .finally(() => seedPrisma.$disconnect());
}
