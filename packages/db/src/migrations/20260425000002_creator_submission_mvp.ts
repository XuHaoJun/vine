import type { Client } from 'pg'

export async function up(client: Client) {
  await client.query(`
CREATE TABLE "creatorProfile" (
  "id" text PRIMARY KEY NOT NULL,
  "userId" text NOT NULL,
  "displayName" text NOT NULL,
  "country" text NOT NULL,
  "bio" text DEFAULT '' NOT NULL,
  "avatarDriveKey" text,
  "kycTier" text DEFAULT 'tier1' NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "creatorProfile_userId_unique" ON "creatorProfile" ("userId");
CREATE INDEX "creatorProfile_status_idx" ON "creatorProfile" ("status");

ALTER TABLE "stickerPackage" ADD COLUMN "creatorId" text;
ALTER TABLE "stickerPackage" ADD COLUMN "status" text DEFAULT 'on_sale' NOT NULL;
ALTER TABLE "stickerPackage" ADD COLUMN "stickerType" text DEFAULT 'static' NOT NULL;
ALTER TABLE "stickerPackage" ADD COLUMN "locale" text DEFAULT 'zh-TW' NOT NULL;
ALTER TABLE "stickerPackage" ADD COLUMN "tags" text DEFAULT '[]' NOT NULL;
ALTER TABLE "stickerPackage" ADD COLUMN "copyrightText" text DEFAULT '' NOT NULL;
ALTER TABLE "stickerPackage" ADD COLUMN "licenseConfirmedAt" timestamp;
ALTER TABLE "stickerPackage" ADD COLUMN "autoPublish" boolean DEFAULT true NOT NULL;
ALTER TABLE "stickerPackage" ADD COLUMN "submittedAt" timestamp;
ALTER TABLE "stickerPackage" ADD COLUMN "reviewedAt" timestamp;
ALTER TABLE "stickerPackage" ADD COLUMN "publishedAt" timestamp;
ALTER TABLE "stickerPackage" ADD COLUMN "reviewReasonCategory" text;
ALTER TABLE "stickerPackage" ADD COLUMN "reviewReasonText" text;
ALTER TABLE "stickerPackage" ADD COLUMN "reviewSuggestion" text;
ALTER TABLE "stickerPackage" ADD COLUMN "reviewProblemAssetNumbers" text DEFAULT '[]' NOT NULL;
CREATE INDEX "stickerPackage_creatorId_idx" ON "stickerPackage" ("creatorId");
CREATE INDEX "stickerPackage_status_idx" ON "stickerPackage" ("status");

CREATE TABLE "stickerAsset" (
  "id" text PRIMARY KEY NOT NULL,
  "packageId" text NOT NULL,
  "number" integer NOT NULL,
  "driveKey" text NOT NULL,
  "width" integer NOT NULL,
  "height" integer NOT NULL,
  "sizeBytes" integer NOT NULL,
  "mimeType" text NOT NULL,
  "resourceType" text DEFAULT 'static' NOT NULL,
  "keywords" text DEFAULT '[]' NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX "stickerAsset_packageId_idx" ON "stickerAsset" ("packageId");
CREATE UNIQUE INDEX "stickerAsset_packageNumber_unique" ON "stickerAsset" ("packageId", "number");

CREATE TABLE "stickerReviewEvent" (
  "id" text PRIMARY KEY NOT NULL,
  "packageId" text NOT NULL,
  "actorUserId" text NOT NULL,
  "action" text NOT NULL,
  "reasonCategory" text,
  "reasonText" text,
  "suggestion" text,
  "problemAssetNumbers" text DEFAULT '[]' NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX "stickerReviewEvent_packageId_idx" ON "stickerReviewEvent" ("packageId");
`)
}

export async function down(client: Client) {
  await client.query(`
DROP INDEX IF EXISTS "stickerReviewEvent_packageId_idx";
DROP TABLE IF EXISTS "stickerReviewEvent";
DROP INDEX IF EXISTS "stickerAsset_packageNumber_unique";
DROP INDEX IF EXISTS "stickerAsset_packageId_idx";
DROP TABLE IF EXISTS "stickerAsset";
DROP INDEX IF EXISTS "stickerPackage_status_idx";
DROP INDEX IF EXISTS "stickerPackage_creatorId_idx";
ALTER TABLE "stickerPackage" DROP COLUMN IF EXISTS "reviewProblemAssetNumbers";
ALTER TABLE "stickerPackage" DROP COLUMN IF EXISTS "reviewSuggestion";
ALTER TABLE "stickerPackage" DROP COLUMN IF EXISTS "reviewReasonText";
ALTER TABLE "stickerPackage" DROP COLUMN IF EXISTS "reviewReasonCategory";
ALTER TABLE "stickerPackage" DROP COLUMN IF EXISTS "publishedAt";
ALTER TABLE "stickerPackage" DROP COLUMN IF EXISTS "reviewedAt";
ALTER TABLE "stickerPackage" DROP COLUMN IF EXISTS "submittedAt";
ALTER TABLE "stickerPackage" DROP COLUMN IF EXISTS "autoPublish";
ALTER TABLE "stickerPackage" DROP COLUMN IF EXISTS "licenseConfirmedAt";
ALTER TABLE "stickerPackage" DROP COLUMN IF EXISTS "copyrightText";
ALTER TABLE "stickerPackage" DROP COLUMN IF EXISTS "tags";
ALTER TABLE "stickerPackage" DROP COLUMN IF EXISTS "locale";
ALTER TABLE "stickerPackage" DROP COLUMN IF EXISTS "stickerType";
ALTER TABLE "stickerPackage" DROP COLUMN IF EXISTS "status";
ALTER TABLE "stickerPackage" DROP COLUMN IF EXISTS "creatorId";
DROP INDEX IF EXISTS "creatorProfile_status_idx";
DROP INDEX IF EXISTS "creatorProfile_userId_unique";
DROP TABLE IF EXISTS "creatorProfile";
`)
}
