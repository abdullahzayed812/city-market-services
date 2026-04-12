import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("users", (table) => {
    table.uuid("id").primary();
    table.string("email", 255).notNullable().unique();
    table.string("password_hash", 255).notNullable();
    table.string("role", 50).notNullable();
    table.boolean("is_active").defaultTo(true);
    table.timestamp("created_at").defaultTo(knex.fn.now());
    table.timestamp("updated_at").defaultTo(knex.fn.now());
    table.timestamp("deleted_at").nullable();

    table.index(["email"], "idx_email");
    table.index(["role"], "idx_role");
    table.index(["deleted_at"], "idx_deleted_at");
  });

  await knex.schema.createTable("refresh_tokens", (table) => {
    table.uuid("id").primary();
    table.uuid("user_id").notNullable();
    table.string("token", 512).notNullable().unique();
    table.timestamp("expires_at").notNullable();
    table.timestamp("created_at").defaultTo(knex.fn.now());

    table.foreign("user_id").references("id").inTable("users").onDelete("CASCADE");
    table.index(["user_id"], "idx_user_id");
    table.index(["token"], "idx_token");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("refresh_tokens");
  await knex.schema.dropTableIfExists("users");
}
