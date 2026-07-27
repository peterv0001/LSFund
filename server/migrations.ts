import { pool as defaultPool } from "./db";
import { Pool, PoolClient } from "pg";

const ADVISORY_LOCK_KEY = 8_675_309;

async function ensureMigrationsTable(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

async function hasRun(client: PoolClient, name: string): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM schema_migrations WHERE name = $1) AS exists`,
    [name]
  );
  return result.rows[0].exists;
}

async function markRun(client: PoolClient, name: string): Promise<void> {
  await client.query(
    `INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT DO NOTHING`,
    [name]
  );
}

async function unmarkRun(client: PoolClient, name: string): Promise<void> {
  await client.query(`DELETE FROM schema_migrations WHERE name = $1`, [name]);
}

export type Migration = {
  name: string;
  run: (client: PoolClient) => Promise<void>;
  down?: (client: PoolClient) => Promise<void>;
};

/**
 * Thrown by a migration's `run` when it cannot be safely applied yet because of
 * existing data that must be cleaned up first. Unlike a normal error, this does
 * NOT crash startup: the migration is rolled back, left pending, and a clear
 * warning is logged so admins can resolve the underlying data and then apply
 * the migration (automatically on the next boot, or manually from the admin
 * migrations panel). The `message` is a human-readable report safe to show admins.
 */
export class MigrationDeferredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MigrationDeferredError";
  }
}

/** Prefix used to recognize the placement-uniqueness duplicate report message. */
export const DUPLICATE_PLACEMENT_ERROR_PREFIX =
  "Cannot apply the binary-tree placement uniqueness index";

export type DuplicatePlacement = {
  placementId: number;
  leg: string;
  agentIds: number[];
};

/**
 * Finds binary-tree placement slots that are occupied by more than one agent
 * — i.e. duplicate (placement_id, leg) pairs. These are the rows that would
 * make the placement uniqueness index fail to build. The root agent (NULL
 * placement_id/leg) is excluded by design.
 */
export async function findDuplicatePlacements(
  client: PoolClient
): Promise<DuplicatePlacement[]> {
  const result = await client.query<{
    placement_id: number;
    leg: string;
    agent_ids: number[];
  }>(`
    SELECT placement_id, leg, array_agg(id ORDER BY id) AS agent_ids
    FROM agents
    WHERE placement_id IS NOT NULL AND leg IS NOT NULL
    GROUP BY placement_id, leg
    HAVING COUNT(*) > 1
    ORDER BY placement_id, leg
  `);
  return result.rows.map((r) => ({
    placementId: r.placement_id,
    leg: r.leg,
    agentIds: r.agent_ids,
  }));
}

/**
 * Builds a clear, admin-readable report of conflicting placements. The first
 * line starts with DUPLICATE_PLACEMENT_ERROR_PREFIX so callers (the admin apply
 * route) can recognize it and surface it verbatim instead of a generic error.
 */
export function formatDuplicatePlacementReport(
  duplicates: DuplicatePlacement[]
): string {
  const slotCount = duplicates.length;
  const agentCount = duplicates.reduce((sum, d) => sum + d.agentIds.length, 0);
  const lines = duplicates.map(
    (d) =>
      `  • Parent agent #${d.placementId}, ${d.leg} leg: agents ${d.agentIds
        .map((id) => `#${id}`)
        .join(", ")}`
  );
  return (
    `${DUPLICATE_PLACEMENT_ERROR_PREFIX}: ${slotCount} placement slot${
      slotCount === 1 ? "" : "s"
    } ${slotCount === 1 ? "is" : "are"} occupied by more than one agent ` +
    `(${agentCount} agents in conflict). Each conflict must be resolved by moving the extra ` +
    `agent(s) to an open slot before this index can be created:\n` +
    lines.join("\n")
  );
}

export const migrations: Migration[] = [
  {
    name: "001_add_paused_at_column",
    async run(client) {
      await client.query(`
        ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS paused_at timestamp
      `);
      console.log("[migrations] Added paused_at column to subscriptions table");
    },
    async down(client) {
      await client.query(`
        ALTER TABLE subscriptions DROP COLUMN IF EXISTS paused_at
      `);
      console.log("[migrations] Dropped paused_at column from subscriptions table");
    },
  },
  {
    name: "002_backfill_paused_at",
    async run(client) {
      const result = await client.query(`
        UPDATE subscriptions
        SET paused_at = updated_at
        WHERE status = 'paused' AND paused_at IS NULL
      `);
      const count = result.rowCount ?? 0;
      console.log(
        `[migrations] Backfilled paused_at for ${count} paused subscription(s)`
      );
    },
    async down(client) {
      // NOTE: This clears paused_at for all currently-paused rows.
      // If the migration is reverted long after deploy, any paused_at values
      // that were legitimately set after the backfill will also be cleared.
      // This rollback is safest when applied shortly after the forward migration.
      const result = await client.query(`
        UPDATE subscriptions
        SET paused_at = NULL
        WHERE status = 'paused'
      `);
      const count = result.rowCount ?? 0;
      console.log(
        `[migrations] Cleared backfilled paused_at for ${count} paused subscription(s)`
      );
    },
  },
  {
    name: "003_add_reactivated_columns",
    async run(client) {
      await client.query(`
        ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS reactivated_at timestamp
      `);
      await client.query(`
        ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS reactivated_by_id integer
      `);
      console.log("[migrations] Added reactivated_at and reactivated_by_id columns to subscriptions table");
    },
    async down(client) {
      await client.query(`
        ALTER TABLE subscriptions DROP COLUMN IF EXISTS reactivated_at
      `);
      await client.query(`
        ALTER TABLE subscriptions DROP COLUMN IF EXISTS reactivated_by_id
      `);
      console.log("[migrations] Dropped reactivated_at and reactivated_by_id columns from subscriptions table");
    },
  },
  {
    name: "004_add_cancelled_and_paused_by_columns",
    async run(client) {
      await client.query(`
        ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancelled_at timestamp
      `);
      await client.query(`
        ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancelled_by_id integer
      `);
      await client.query(`
        ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS paused_by_id integer
      `);
      console.log("[migrations] Added cancelled_at, cancelled_by_id, paused_by_id columns to subscriptions table");
    },
    async down(client) {
      await client.query(`
        ALTER TABLE subscriptions DROP COLUMN IF EXISTS cancelled_at
      `);
      await client.query(`
        ALTER TABLE subscriptions DROP COLUMN IF EXISTS cancelled_by_id
      `);
      await client.query(`
        ALTER TABLE subscriptions DROP COLUMN IF EXISTS paused_by_id
      `);
      console.log("[migrations] Dropped cancelled_at, cancelled_by_id, paused_by_id columns from subscriptions table");
    },
  },
  {
    name: "005_add_subscription_email_preferences",
    async run(client) {
      await client.query(`
        ALTER TABLE agents
        ADD COLUMN IF NOT EXISTS subscription_email_preferences jsonb
        NOT NULL DEFAULT '{"emailOnPaused": true, "emailOnCancelled": true, "emailOnReactivated": true}'::jsonb
      `);
      console.log("[migrations] Added subscription_email_preferences column to agents table");
    },
    async down(client) {
      await client.query(`
        ALTER TABLE agents DROP COLUMN IF EXISTS subscription_email_preferences
      `);
      console.log("[migrations] Dropped subscription_email_preferences column from agents table");
    },
  },
  {
    name: "006_add_subscription_end_date",
    async run(client) {
      await client.query(`
        ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS end_date timestamp
      `);
      console.log("[migrations] Added end_date column to subscriptions table");
    },
    async down(client) {
      await client.query(`
        ALTER TABLE subscriptions DROP COLUMN IF EXISTS end_date
      `);
      console.log("[migrations] Dropped end_date column from subscriptions table");
    },
  },
  {
    name: "007_rename_subscription_email_preferences_to_email_preferences",
    async run(client) {
      // Check current column state before acting — production DB may have the
      // column already renamed (subscription_email_preferences never existed) or
      // may have subscription_email_preferences still needing the rename.
      const { rows } = await client.query<{ column_name: string }>(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'agents'
          AND column_name IN ('subscription_email_preferences', 'email_preferences')
      `);
      const names = rows.map((r) => r.column_name);
      if (names.includes('email_preferences') && !names.includes('subscription_email_preferences')) {
        console.log("[migrations] email_preferences column already exists — skipping rename");
        return;
      }
      if (!names.includes('subscription_email_preferences')) {
        // Neither column exists — add email_preferences directly
        await client.query(`
          ALTER TABLE agents
          ADD COLUMN IF NOT EXISTS email_preferences jsonb
          NOT NULL DEFAULT '{"emailOnPaused": true, "emailOnCancelled": true, "emailOnReactivated": true}'::jsonb
        `);
        console.log("[migrations] Added email_preferences column (subscription_email_preferences was absent)");
        return;
      }
      await client.query(`
        ALTER TABLE agents
        RENAME COLUMN subscription_email_preferences TO email_preferences
      `);
      console.log("[migrations] Renamed subscription_email_preferences to email_preferences on agents table");
    },
    async down(client) {
      await client.query(`
        ALTER TABLE agents
        RENAME COLUMN email_preferences TO subscription_email_preferences
      `);
      console.log("[migrations] Renamed email_preferences back to subscription_email_preferences on agents table");
    },
  },
  {
    name: "008_add_subscription_id_to_commissions",
    async run(client) {
      await client.query(`
        ALTER TABLE commissions ADD COLUMN IF NOT EXISTS subscription_id integer REFERENCES subscriptions(id) ON DELETE SET NULL
      `);
      await client.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS commissions_subscription_period_type_idx
        ON commissions (agent_id, subscription_id, period_date, type)
        WHERE subscription_id IS NOT NULL
      `);
      console.log("[migrations] Added subscription_id column and unique index to commissions table");
    },
    async down(client) {
      await client.query(`
        DROP INDEX IF EXISTS commissions_subscription_period_type_idx
      `);
      await client.query(`
        ALTER TABLE commissions DROP COLUMN IF EXISTS subscription_id
      `);
      console.log("[migrations] Dropped subscription_id column and index from commissions table");
    },
  },
  {
    name: "009_create_admin_export_templates",
    async run(client) {
      await client.query(`
        CREATE TABLE IF NOT EXISTS admin_export_templates (
          id SERIAL PRIMARY KEY,
          admin_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          columns TEXT[] NOT NULL,
          is_shared BOOLEAN NOT NULL DEFAULT false,
          created_at TIMESTAMP NOT NULL DEFAULT now(),
          updated_at TIMESTAMP NOT NULL DEFAULT now()
        )
      `);
      console.log("[migrations] Created admin_export_templates table");
    },
    async down(client) {
      await client.query(`DROP TABLE IF EXISTS admin_export_templates`);
      console.log("[migrations] Dropped admin_export_templates table");
    },
  },
  {
    name: "010_index_admin_export_templates",
    async run(client) {
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_admin_export_templates_admin_id
          ON admin_export_templates (admin_id);
        CREATE INDEX IF NOT EXISTS idx_admin_export_templates_is_shared
          ON admin_export_templates (is_shared)
          WHERE is_shared = true;
      `);
      console.log("[migrations] Added indexes to admin_export_templates");
    },
    async down(client) {
      await client.query(`
        DROP INDEX IF EXISTS idx_admin_export_templates_admin_id;
        DROP INDEX IF EXISTS idx_admin_export_templates_is_shared;
      `);
      console.log("[migrations] Dropped indexes from admin_export_templates");
    },
  },
  {
    name: "011_add_subscription_billing",
    async run(client) {
      await client.query(`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_billing_status') THEN
            CREATE TYPE subscription_billing_status AS ENUM ('pending', 'active', 'past_due', 'failed', 'cancelled');
          END IF;
        END $$;
      `);
      await client.query(`
        ALTER TABLE subscriptions
          ADD COLUMN IF NOT EXISTS stripe_customer_id text,
          ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
          ADD COLUMN IF NOT EXISTS stripe_payment_method_id text,
          ADD COLUMN IF NOT EXISTS billing_status subscription_billing_status DEFAULT 'pending',
          ADD COLUMN IF NOT EXISTS card_last4 text,
          ADD COLUMN IF NOT EXISTS card_brand text,
          ADD COLUMN IF NOT EXISTS last_charged_at timestamp,
          ADD COLUMN IF NOT EXISTS next_billing_date timestamp
      `);
      console.log("[migrations] Added billing columns to subscriptions table");
    },
    async down(client) {
      await client.query(`
        ALTER TABLE subscriptions
          DROP COLUMN IF EXISTS stripe_customer_id,
          DROP COLUMN IF EXISTS stripe_subscription_id,
          DROP COLUMN IF EXISTS stripe_payment_method_id,
          DROP COLUMN IF EXISTS billing_status,
          DROP COLUMN IF EXISTS card_last4,
          DROP COLUMN IF EXISTS card_brand,
          DROP COLUMN IF EXISTS last_charged_at,
          DROP COLUMN IF EXISTS next_billing_date
      `);
      await client.query(`DROP TYPE IF EXISTS subscription_billing_status`);
      console.log("[migrations] Dropped billing columns from subscriptions table");
    },
  },
  {
    name: "012_nullify_billing_status_for_legacy_subscriptions",
    async run(client) {
      await client.query(`
        ALTER TABLE subscriptions ALTER COLUMN billing_status DROP DEFAULT
      `);
      await client.query(`
        UPDATE subscriptions
          SET billing_status = NULL
          WHERE stripe_customer_id IS NULL
            AND billing_status = 'pending'
      `);
      console.log("[migrations] Removed billing_status default and reset NULL for legacy subscriptions");
    },
    async down(client) {
      await client.query(`
        ALTER TABLE subscriptions ALTER COLUMN billing_status SET DEFAULT 'pending'
      `);
      await client.query(`
        UPDATE subscriptions
          SET billing_status = 'pending'
          WHERE stripe_customer_id IS NULL
            AND billing_status IS NULL
      `);
      console.log("[migrations] Restored billing_status default and legacy values");
    },
  },
  {
    name: "013_billing_status_drop_column_default",
    async run(client) {
      await client.query(`
        ALTER TABLE subscriptions ALTER COLUMN billing_status DROP DEFAULT
      `);
      console.log("[migrations] Dropped billing_status column default");
    },
    async down(client) {
      await client.query(`
        ALTER TABLE subscriptions ALTER COLUMN billing_status SET DEFAULT 'pending'
      `);
      console.log("[migrations] Restored billing_status column default");
    },
  },
  {
    name: "014_add_subscription_expiry_warning_sent_at",
    async run(client) {
      await client.query(`
        ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS expiry_warning_sent_at TIMESTAMP
      `);
      console.log("[migrations] Added expiry_warning_sent_at column to subscriptions");
    },
    async down(client) {
      await client.query(`
        ALTER TABLE subscriptions DROP COLUMN IF EXISTS expiry_warning_sent_at
      `);
      console.log("[migrations] Dropped expiry_warning_sent_at column from subscriptions");
    },
  },
  {
    name: "015_add_deal_commission_unique_index",
    async run(client) {
      await client.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS commissions_deal_type_idx
        ON commissions (agent_id, deal_id, type)
        WHERE deal_id IS NOT NULL
      `);
      console.log("[migrations] Added unique index on deal-based commissions (agent_id, deal_id, type)");
    },
    async down(client) {
      await client.query(`
        DROP INDEX IF EXISTS commissions_deal_type_idx
      `);
      console.log("[migrations] Dropped unique index on deal-based commissions");
    },
  },
  {
    name: "016_add_agents_placement_leg_unique_index",
    async run(client) {
      // Guard: a long-lived database that accumulated duplicate placements from
      // the old binary-tree bug would make CREATE UNIQUE INDEX fail with a
      // cryptic unique-violation error and crash startup. Detect those rows
      // first and defer with a clear, actionable report instead.
      const duplicates = await findDuplicatePlacements(client);
      if (duplicates.length > 0) {
        throw new MigrationDeferredError(formatDuplicatePlacementReport(duplicates));
      }
      await client.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS agents_placement_leg_unique_idx
        ON agents (placement_id, leg)
        WHERE placement_id IS NOT NULL AND leg IS NOT NULL
      `);
      console.log("[migrations] Added unique index on binary-tree placement (placement_id, leg)");
    },
    async down(client) {
      await client.query(`
        DROP INDEX IF EXISTS agents_placement_leg_unique_idx
      `);
      console.log("[migrations] Dropped unique index on binary-tree placement");
    },
  },
  {
    name: "017_create_agent_invitations",
    async run(client) {
      await client.query(`
        DO $$ BEGIN
          CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'cancelled', 'expired');
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;
      `);
      await client.query(`
        CREATE TABLE IF NOT EXISTS agent_invitations (
          id SERIAL PRIMARY KEY,
          inviter_id INTEGER NOT NULL,
          first_name TEXT NOT NULL,
          last_name TEXT NOT NULL,
          email TEXT NOT NULL,
          placement_leg TEXT NOT NULL DEFAULT 'auto',
          token TEXT NOT NULL UNIQUE,
          status invitation_status NOT NULL DEFAULT 'pending',
          expires_at TIMESTAMP NOT NULL,
          accepted_agent_id INTEGER,
          created_at TIMESTAMP NOT NULL DEFAULT now(),
          updated_at TIMESTAMP NOT NULL DEFAULT now()
        )
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS agent_invitations_inviter_idx
        ON agent_invitations (inviter_id)
      `);
      console.log("[migrations] Created agent_invitations table");
    },
    async down(client) {
      await client.query(`DROP TABLE IF EXISTS agent_invitations`);
      await client.query(`DROP TYPE IF EXISTS invitation_status`);
      console.log("[migrations] Dropped agent_invitations table");
    },
  },
  {
    name: "018_add_subscription_tier_4",
    async run(client) {
      await client.query(
        `ALTER TYPE subscription_tier ADD VALUE IF NOT EXISTS 'tier_4'`
      );
      console.log("[migrations] Added 'tier_4' to subscription_tier enum");
    },
    async down() {
      // PostgreSQL does not support removing a value from an enum type without
      // recreating the type and rewriting every dependent column, so this
      // migration is intentionally not reversible. Leaving the extra enum value
      // in place is harmless.
      console.log(
        "[migrations] 018_add_subscription_tier_4 down is a no-op (enum values cannot be dropped)"
      );
    },
  },
  {
    name: "019_create_landing_page_views",
    async run(client) {
      await client.query(`
        CREATE TABLE IF NOT EXISTS landing_page_views (
          id SERIAL PRIMARY KEY,
          agent_id INTEGER NOT NULL,
          page TEXT NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT now()
        )
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS landing_page_views_agent_page_idx
        ON landing_page_views (agent_id, page)
      `);
      console.log("[migrations] Created landing_page_views table");
    },
    async down(client) {
      await client.query(`DROP TABLE IF EXISTS landing_page_views`);
      console.log("[migrations] Dropped landing_page_views table");
    },
  },
  {
    name: "020_add_compensation_v2026_fields",
    async run(client) {
      // --- New enum types (idempotent via duplicate_object guard) ---
      await client.query(`
        DO $$ BEGIN
          CREATE TYPE distributor_tier AS ENUM ('standard', 'enhanced', 'elite');
        EXCEPTION WHEN duplicate_object THEN null; END $$;
      `);
      await client.query(`
        DO $$ BEGIN
          CREATE TYPE agency_model AS ENUM ('independent', 'small_agency', 'leadership', 'recruiting');
        EXCEPTION WHEN duplicate_object THEN null; END $$;
      `);
      await client.query(`
        DO $$ BEGIN
          CREATE TYPE membership_type AS ENUM ('individual', 'small_agency', 'growth_agency', 'enterprise_agency');
        EXCEPTION WHEN duplicate_object THEN null; END $$;
      `);
      await client.query(`
        DO $$ BEGIN
          CREATE TYPE residual_status AS ENUM ('good_standing', 'reduced', 'suspended');
        EXCEPTION WHEN duplicate_object THEN null; END $$;
      `);
      await client.query(`
        DO $$ BEGIN
          CREATE TYPE commission_model AS ENUM ('legacy', 'v2026');
        EXCEPTION WHEN duplicate_object THEN null; END $$;
      `);

      // --- Agents: additive distributor/agency/membership/residual attributes.
      // Existing agents fall back to sensible defaults (standard / independent /
      // individual / good_standing / 0% override).
      await client.query(`
        ALTER TABLE agents
          ADD COLUMN IF NOT EXISTS distributor_tier distributor_tier NOT NULL DEFAULT 'standard',
          ADD COLUMN IF NOT EXISTS agency_model agency_model NOT NULL DEFAULT 'independent',
          ADD COLUMN IF NOT EXISTS override_split_pct numeric(5,2) NOT NULL DEFAULT 0,
          ADD COLUMN IF NOT EXISTS membership_type membership_type NOT NULL DEFAULT 'individual',
          ADD COLUMN IF NOT EXISTS residual_status residual_status NOT NULL DEFAULT 'good_standing'
      `);

      // --- Deals & subscriptions: per-record commission model flag.
      // Step 1 adds the column with DEFAULT 'legacy' so EVERY existing row keeps
      // its current terms. Step 2 flips the default to 'v2026' so NEW rows opt
      // into the 2026 model going forward, without rewriting history.
      await client.query(`
        ALTER TABLE deals
          ADD COLUMN IF NOT EXISTS commission_model commission_model NOT NULL DEFAULT 'legacy'
      `);
      await client.query(`ALTER TABLE deals ALTER COLUMN commission_model SET DEFAULT 'v2026'`);

      await client.query(`
        ALTER TABLE subscriptions
          ADD COLUMN IF NOT EXISTS commission_model commission_model NOT NULL DEFAULT 'legacy'
      `);
      await client.query(`ALTER TABLE subscriptions ALTER COLUMN commission_model SET DEFAULT 'v2026'`);

      console.log("[migrations] Added 2026 compensation fields (agents attributes + commission_model on deals/subscriptions)");
    },
    async down(client) {
      // Drop columns first, then the enum types they depended on.
      await client.query(`ALTER TABLE subscriptions DROP COLUMN IF EXISTS commission_model`);
      await client.query(`ALTER TABLE deals DROP COLUMN IF EXISTS commission_model`);
      await client.query(`
        ALTER TABLE agents
          DROP COLUMN IF EXISTS distributor_tier,
          DROP COLUMN IF EXISTS agency_model,
          DROP COLUMN IF EXISTS override_split_pct,
          DROP COLUMN IF EXISTS membership_type,
          DROP COLUMN IF EXISTS residual_status
      `);
      await client.query(`DROP TYPE IF EXISTS commission_model`);
      await client.query(`DROP TYPE IF EXISTS residual_status`);
      await client.query(`DROP TYPE IF EXISTS membership_type`);
      await client.query(`DROP TYPE IF EXISTS agency_model`);
      await client.query(`DROP TYPE IF EXISTS distributor_tier`);
      console.log("[migrations] Reverted 2026 compensation fields");
    },
  },
  {
    name: "021_add_subscription_is_member_purchase",
    async run(client) {
      // Internal member purchases generate no commission under v2026. Existing
      // rows default to false (external merchant sale) so legacy behavior and
      // historical reconciliation are unaffected.
      await client.query(`
        ALTER TABLE subscriptions
          ADD COLUMN IF NOT EXISTS is_member_purchase boolean NOT NULL DEFAULT false
      `);
      console.log("[migrations] Added is_member_purchase to subscriptions");
    },
    async down(client) {
      await client.query(`ALTER TABLE subscriptions DROP COLUMN IF EXISTS is_member_purchase`);
      console.log("[migrations] Dropped is_member_purchase from subscriptions");
    },
  },
  {
    name: "022_add_missing_commission_type_enum_values",
    async run(client) {
      // The commission_type enum in shared/schema.ts declares 'fast_start' and
      // 'leadership_pool', but the database enum was never updated to match —
      // latent drift that only surfaces now that the v2026 MCA engine actually
      // pays a performance accelerator as a 'fast_start' commission. Add the
      // missing values idempotently so the DB enum reconciles with the schema.
      await client.query(`ALTER TYPE commission_type ADD VALUE IF NOT EXISTS 'fast_start'`);
      await client.query(`ALTER TYPE commission_type ADD VALUE IF NOT EXISTS 'leadership_pool'`);
      console.log("[migrations] Reconciled commission_type enum (added fast_start, leadership_pool)");
    },
    async down() {
      // PostgreSQL does not support removing a value from an enum type, so this
      // migration is intentionally not reversible.
      console.log("[migrations] 022 down is a no-op (enum values cannot be dropped)");
    },
  },
  {
    name: "023_add_agent_onboarding_fields",
    async run(client) {
      // Placement state enum: existing agents are all 'placed'; new agents whose
      // binary-tree slot can't be resolved at signup land in 'pending' for an
      // admin to resolve, instead of failing the signup with a 500.
      await client.query(`
        DO $$ BEGIN
          CREATE TYPE placement_status AS ENUM ('placed', 'pending');
        EXCEPTION WHEN duplicate_object THEN null; END $$;
      `);
      // Onboarding columns. email_verified_at is NULL for all existing agents;
      // we backfill them to verified below so the new verification gate never
      // locks out accounts that pre-date this feature.
      await client.query(`
        ALTER TABLE agents
          ADD COLUMN IF NOT EXISTS email_verified_at timestamp,
          ADD COLUMN IF NOT EXISTS email_verification_token text,
          ADD COLUMN IF NOT EXISTS placement_status placement_status NOT NULL DEFAULT 'placed',
          ADD COLUMN IF NOT EXISTS onboarding_dismissed_at timestamp
      `);
      // Backfill: treat every pre-existing account as already email-verified so
      // the new deal/subscription gate doesn't retroactively block them. Only
      // agents created from now on start unverified.
      const result = await client.query(`
        UPDATE agents SET email_verified_at = now() WHERE email_verified_at IS NULL
      `);
      console.log(
        `[migrations] Added onboarding fields to agents and backfilled ${result.rowCount ?? 0} existing agent(s) as verified`
      );
    },
    async down(client) {
      await client.query(`
        ALTER TABLE agents
          DROP COLUMN IF EXISTS email_verified_at,
          DROP COLUMN IF EXISTS email_verification_token,
          DROP COLUMN IF EXISTS placement_status,
          DROP COLUMN IF EXISTS onboarding_dismissed_at
      `);
      await client.query(`DROP TYPE IF EXISTS placement_status`);
      console.log("[migrations] Reverted agent onboarding fields");
    },
  },
  {
    name: "024_strip_email_on_expiry_warning_preference",
    async run(client) {
      // Expiry warning emails are now always sent and can no longer be turned
      // off; the emailOnExpiryWarning flag was removed from the schema and
      // settings UI. Strip the stale key from any stored emailPreferences JSON
      // so persisted records match the current schema.
      const result = await client.query(`
        UPDATE agents
        SET email_preferences = email_preferences - 'emailOnExpiryWarning'
        WHERE email_preferences ? 'emailOnExpiryWarning'
      `);
      console.log(
        `[migrations] Removed emailOnExpiryWarning from ${result.rowCount ?? 0} agent email preference record(s)`
      );
    },
    async down() {
      // The removed key carried no behavior (the code ignores it), so there is
      // nothing meaningful to restore.
      console.log("[migrations] 024 down is a no-op (stale preference key not restored)");
    },
  },
];

export async function runMigrations(options?: {
  pool?: Pool;
  migrations?: Migration[];
}): Promise<void> {
  const pool = options?.pool ?? defaultPool;
  const migrationList = options?.migrations ?? migrations;

  const client = await pool.connect();
  try {
    await client.query(`SELECT pg_advisory_lock($1)`, [ADVISORY_LOCK_KEY]);
    try {
      await ensureMigrationsTable(client);

      for (const migration of migrationList) {
        const alreadyRun = await hasRun(client, migration.name);
        if (alreadyRun) {
          console.log(`[migrations] Skipping ${migration.name} (already applied)`);
          continue;
        }

        console.log(`[migrations] Applying ${migration.name}…`);
        await client.query("BEGIN");
        try {
          await migration.run(client);
          await markRun(client, migration.name);
          await client.query("COMMIT");
          console.log(`[migrations] ${migration.name} applied`);
        } catch (err) {
          await client.query("ROLLBACK");
          // A deferred migration is not a failure: the data isn't ready yet.
          // Leave it pending, warn loudly with the actionable report, and keep
          // booting so admins can log in and resolve the conflict.
          if (err instanceof MigrationDeferredError) {
            console.warn(
              `[migrations] ${migration.name} deferred — left pending, startup continues.\n${err.message}`
            );
            continue;
          }
          console.error(
            `[migrations] ${migration.name} failed — transaction rolled back`,
            err
          );
          throw err;
        }
      }
    } finally {
      await client.query(`SELECT pg_advisory_unlock($1)`, [ADVISORY_LOCK_KEY]);
    }
  } finally {
    client.release();
  }
}

/**
 * Applies a single named migration that has not yet been applied. Runs its
 * `run` function inside a transaction. On success the row is inserted into
 * `schema_migrations`. On failure the transaction is rolled back.
 */
export async function applyMigration(
  name: string,
  options?: {
    pool?: Pool;
    migrations?: Migration[];
  }
): Promise<void> {
  const pool = options?.pool ?? defaultPool;
  const migrationList = options?.migrations ?? migrations;

  const migration = migrationList.find((m) => m.name === name);
  if (!migration) {
    throw new Error(`Migration "${name}" not found`);
  }

  const client = await pool.connect();
  try {
    await client.query(`SELECT pg_advisory_lock($1)`, [ADVISORY_LOCK_KEY]);
    try {
      await ensureMigrationsTable(client);

      const alreadyApplied = await hasRun(client, name);
      if (alreadyApplied) {
        throw new Error(`Migration "${name}" has already been applied`);
      }

      // Enforce ordering: all earlier migrations in the list must be applied first
      const migrationIndex = migrationList.findIndex((m) => m.name === name);
      const unappliedEarlier: string[] = [];
      for (const earlier of migrationList.slice(0, migrationIndex)) {
        if (!(await hasRun(client, earlier.name))) {
          unappliedEarlier.push(earlier.name);
        }
      }
      if (unappliedEarlier.length > 0) {
        const list = unappliedEarlier.map((n) => `"${n}"`).join(", ");
        const plural = unappliedEarlier.length > 1 ? "s" : "";
        throw new Error(
          `Cannot apply "${name}" — the following earlier migration${plural} must be applied first: ${list}`
        );
      }

      console.log(`[migrations] Applying ${name}…`);
      await client.query("BEGIN");
      try {
        await migration.run(client);
        await markRun(client, name);
        await client.query("COMMIT");
        console.log(`[migrations] ${name} applied`);
      } catch (err) {
        await client.query("ROLLBACK");
        // A deferred migration is not a failure: re-throw so the caller can
        // surface the actionable report to the admin, without scary logging.
        if (err instanceof MigrationDeferredError) {
          console.warn(`[migrations] ${name} deferred — left pending.\n${err.message}`);
          throw err;
        }
        console.error(
          `[migrations] ${name} failed — transaction rolled back`,
          err
        );
        throw err;
      }
    } finally {
      await client.query(`SELECT pg_advisory_unlock($1)`, [ADVISORY_LOCK_KEY]);
    }
  } finally {
    client.release();
  }
}

/**
 * Reverts a previously applied migration by running its `down` function inside
 * a transaction. On success the row is removed from `schema_migrations`.
 * On failure the transaction is rolled back, leaving the database unchanged.
 *
 * Important: migrations should generally be reverted in reverse-application
 * order. Rolling back a migration that later migrations depend on can leave
 * the database in an inconsistent state.
 */
export async function revertMigration(
  name: string,
  options?: {
    pool?: Pool;
    migrations?: Migration[];
  }
): Promise<void> {
  const pool = options?.pool ?? defaultPool;
  const migrationList = options?.migrations ?? migrations;

  const migration = migrationList.find((m) => m.name === name);
  if (!migration) {
    throw new Error(`Migration "${name}" not found`);
  }
  if (!migration.down) {
    throw new Error(`Migration "${name}" does not have a down function`);
  }

  const client = await pool.connect();
  try {
    await client.query(`SELECT pg_advisory_lock($1)`, [ADVISORY_LOCK_KEY]);
    try {
      await ensureMigrationsTable(client);

      const applied = await hasRun(client, name);
      if (!applied) {
        throw new Error(`Migration "${name}" has not been applied`);
      }

      console.log(`[migrations] Reverting ${name}…`);
      await client.query("BEGIN");
      try {
        await migration.down!(client);
        await unmarkRun(client, name);
        await client.query("COMMIT");
        console.log(`[migrations] ${name} reverted`);
      } catch (err) {
        await client.query("ROLLBACK");
        console.error(
          `[migrations] ${name} revert failed — transaction rolled back`,
          err
        );
        throw err;
      }
    } finally {
      await client.query(`SELECT pg_advisory_unlock($1)`, [ADVISORY_LOCK_KEY]);
    }
  } finally {
    client.release();
  }
}
