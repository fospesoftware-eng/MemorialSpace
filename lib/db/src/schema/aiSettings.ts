import {
  pgTable,
  integer,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/**
 * Platform-level AI configuration singleton (id = 1).
 *
 * Stores the Anthropic API key used by the AI Map Maker feature.
 * Secrets are stored in plaintext in MVP; before production launch
 * they should be wrapped with envelope encryption (KMS/age) at rest.
 * The API always masks the key on reads — see the route handler.
 */
export const platformAiSettingsTable = pgTable("platform_ai_settings", {
  id: integer("id").primaryKey(),
  anthropicApiKey: text("anthropic_api_key"),
  // We may add model, temperature, max-tokens later.
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type PlatformAiSettings =
  typeof platformAiSettingsTable.$inferSelect;
