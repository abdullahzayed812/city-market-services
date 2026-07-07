import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  const hasSessions = await knex.schema.hasTable("sessions");
  if (!hasSessions) {
    await knex.schema.createTable("sessions", (table) => {
      table.uuid("id").primary();
      table.uuid("user_id").notNullable();
      table.string("device_id", 255).notNullable();
      table.string("platform", 20).nullable();
      table.string("browser", 100).nullable();
      table.string("os", 100).nullable();
      table.string("device_name", 255).nullable();
      table.string("ip_address", 45).nullable();
      table.string("refresh_token_hash", 64).notNullable();
      table.string("previous_token_hash", 64).nullable();
      table.timestamp("last_activity").notNullable().defaultTo(knex.fn.now());
      table.timestamp("expires_at").notNullable();
      table.boolean("revoked").notNullable().defaultTo(false);
      table.string("revoked_reason", 50).nullable();
      table.timestamp("revoked_at").nullable();
      table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());

      table.foreign("user_id").references("id").inTable("users").onDelete("CASCADE");
      table.index(["user_id"], "idx_sessions_user_id");
      table.unique(["refresh_token_hash"], { indexName: "idx_sessions_refresh_token_hash" });
      table.index(["previous_token_hash"], "idx_sessions_previous_token_hash");
      table.index(["user_id", "revoked"], "idx_sessions_user_revoked");
    });
  }

  // Reconcile: the old "active_session" column (added via a stray, never-knex-tracked
  // .sql file) is superseded by the sessions table and dropped here if present.
  const hasActiveSession = await knex.schema.hasColumn("users", "active_session");
  if (hasActiveSession) {
    await knex.schema.alterTable("users", (table) => {
      table.dropColumn("active_session");
    });
  }

  const hasRefreshTokens = await knex.schema.hasTable("refresh_tokens");
  if (hasRefreshTokens) {
    await knex.schema.dropTable("refresh_tokens");
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("sessions");
  const hasActiveSession = await knex.schema.hasColumn("users", "active_session");
  if (!hasActiveSession) {
    await knex.schema.alterTable("users", (table) => {
      table.string("active_session", 64).nullable();
    });
  }
}
