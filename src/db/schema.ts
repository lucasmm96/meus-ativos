import {
  pgTable,
  pgEnum,
  uuid,
  text,
  varchar,
  timestamp,
  date,
  numeric,
  integer,
  boolean,
  primaryKey,
} from 'drizzle-orm/pg-core';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const tipoAtivo = pgEnum('tipo_ativo', ['ACAO', 'FII']);

export const tipoEventoCorporativo = pgEnum('tipo_evento_corporativo', [
  'SPLIT',
  'GRUPAMENTO',
  'BONIFICACAO',
  'SUBSCRICAO',
  'MUDANCA_TICKER',
  'MUDANCA_NOME',
  'CISAO',
  'FUSAO',
  'INCORPORACAO',
  'IPO',
  'CANCELAMENTO',
]);

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').unique().notNull(),
  name: text('name'),
  createdAt: timestamp('createdAt').defaultNow(),
});

export const ativos = pgTable('ativos', {
  ticker: varchar('ticker', { length: 10 }).primaryKey(),
  nome: text('nome').notNull(),
  tipo: tipoAtivo('tipo').notNull(),
  /** Ticker used for price lookup — same as ticker but without the "F" suffix for fractional shares */
  tickerCotacao: varchar('tickerCotacao', { length: 10 }).notNull(),
  /** true = actively traded; false = alias row for an extinct/renamed ticker */
  negociavel: boolean('negociavel').notNull().default(true),
});

export const transacoes = pgTable('transacoes', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('userId')
    .notNull()
    .references(() => users.id),
  ativoTicker: varchar('ativoTicker', { length: 10 })
    .notNull()
    .references(() => ativos.ticker),
  data: date('data').notNull(),
  valorUnitario: numeric('valorUnitario', { precision: 18, scale: 6 }).notNull(),
  quantidade: integer('quantidade').notNull(),
  ajustadaManualmente: boolean('ajustadaManualmente').notNull().default(false),
  createdAt: timestamp('createdAt').defaultNow(),
});

export const cotacoes = pgTable(
  'cotacoes',
  {
    ativoTicker: varchar('ativoTicker', { length: 10 })
      .notNull()
      .references(() => ativos.ticker),
    data: date('data').notNull(),
    precoFechamento: numeric('precoFechamento', { precision: 18, scale: 6 }).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.ativoTicker, table.data] }),
  }),
);

export const arquivamentos = pgTable(
  'arquivamentos',
  {
    userId: uuid('userId')
      .notNull()
      .references(() => users.id),
    transacaoId: uuid('transacaoId')
      .notNull()
      .references(() => transacoes.id, { onDelete: 'cascade' }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.transacaoId] }),
  }),
);

export const eventosCorporativos = pgTable('eventos_corporativos', {
  id: uuid('id').primaryKey().defaultRandom(),
  tipo: tipoEventoCorporativo('tipo').notNull(),
  ticker: varchar('ticker', { length: 10 }).notNull(),
  tickerRelacionado: varchar('ticker_relacionado', { length: 10 }),
  dataEfetiva: date('data_efetiva').notNull(),
  fatorAjuste: numeric('fator_ajuste', { precision: 18, scale: 10 }),
  descricao: text('descricao'),
  fonte: varchar('fonte', { length: 50 }).notNull(),
  fonteUrl: text('fonte_url'),
  ingeridoEm: timestamp('ingerido_em').defaultNow().notNull(),
});

export const backfillProgress = pgTable('backfill_progress', {
  ticker: varchar('ticker', { length: 10 })
    .primaryKey()
    .references(() => ativos.ticker, { onDelete: 'cascade' }),
  status: varchar('status', { length: 20 }).notNull().default('pendente'),
  ultimaTentativa: timestamp('ultima_tentativa', { withTimezone: true }),
  motivoFalha: text('motivo_falha'),
});

// ---------------------------------------------------------------------------
// Schema object (passed to drizzle({ schema }))
// ---------------------------------------------------------------------------

export const schema = {
  users,
  ativos,
  transacoes,
  cotacoes,
  arquivamentos,
  eventosCorporativos,
  backfillProgress,
} as const;

// ---------------------------------------------------------------------------
// DB type — inferred from schema, exported for use in client.ts
// ---------------------------------------------------------------------------

export type DB = NeonHttpDatabase<typeof schema>;
