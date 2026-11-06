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
  primaryKey,
} from 'drizzle-orm/pg-core';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const tipoAtivo = pgEnum('tipo_ativo', ['ACAO', 'FII']);

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').unique().notNull(),
  createdAt: timestamp('createdAt').defaultNow(),
});

export const ativos = pgTable('ativos', {
  ticker: varchar('ticker', { length: 10 }).primaryKey(),
  nome: text('nome').notNull(),
  tipo: tipoAtivo('tipo').notNull(),
  /** Ticker used for price lookup — same as ticker but without the "F" suffix for fractional shares */
  tickerCotacao: varchar('tickerCotacao', { length: 10 }).notNull(),
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

// ---------------------------------------------------------------------------
// Schema object (passed to drizzle({ schema }))
// ---------------------------------------------------------------------------

export const schema = {
  users,
  ativos,
  transacoes,
  cotacoes,
  arquivamentos,
} as const;

// ---------------------------------------------------------------------------
// DB type — inferred from schema, exported for use in client.ts
// ---------------------------------------------------------------------------

export type DB = NeonHttpDatabase<typeof schema>;
