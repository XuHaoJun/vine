import type { PoolClient } from 'pg'

export async function up(client: PoolClient): Promise<void> {
  await client.query(`
    ALTER TABLE "oaCampaign"
      ADD COLUMN "messagePayloadJson" jsonb,
      ADD COLUMN "messageSummary" text NOT NULL DEFAULT '';

    UPDATE "oaCampaign"
    SET
      "messagePayloadJson" = jsonb_build_array(
        jsonb_build_object('type', 'text', 'text', "messageText")
      ),
      "messageSummary" = "messageText"
    WHERE "messagePayloadJson" IS NULL;

    ALTER TABLE "oaCampaign"
      ALTER COLUMN "messagePayloadJson" SET NOT NULL,
      ALTER COLUMN "messagePayloadJson" SET DEFAULT '[]'::jsonb,
      ALTER COLUMN "messageText" DROP NOT NULL;
  `)
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`
    UPDATE "oaCampaign"
    SET "messageText" = COALESCE(NULLIF("messageText", ''), NULLIF("messageSummary", ''), 'Rich message campaign')
    WHERE "messageText" IS NULL;

    ALTER TABLE "oaCampaign"
      ALTER COLUMN "messageText" SET NOT NULL,
      DROP COLUMN IF EXISTS "messagePayloadJson",
      DROP COLUMN IF EXISTS "messageSummary";
  `)
}
