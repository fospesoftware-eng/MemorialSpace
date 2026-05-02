/**
 * Session store table consumed by `connect-pg-simple`. Drizzle owns the
 * schema so it survives `db push` and migrations.
 */
import { pgTable, varchar, json, timestamp, index } from "drizzle-orm/pg-core";

export const sessionsTable = pgTable(
  "session",
  {
    sid: varchar("sid").primaryKey(),
    sess: json("sess").notNull(),
    expire: timestamp("expire", { precision: 6 }).notNull(),
  },
  (t) => ({
    expireIdx: index("IDX_session_expire").on(t.expire),
  }),
);
