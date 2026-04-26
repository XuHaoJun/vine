import type { PoolClient } from 'pg'

export async function up(client: PoolClient) {
  await client.query(`
CREATE TABLE "creatorFollow" (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL,
  "creatorId" text NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "creatorFollow_userId_creatorId_unique" ON "creatorFollow" ("userId", "creatorId");
CREATE INDEX "creatorFollow_creatorId_idx" ON "creatorFollow" ("creatorId");
CREATE INDEX "creatorFollow_userId_idx" ON "creatorFollow" ("userId");

CREATE TABLE "stickerPackageReview" (
  "id" text PRIMARY KEY,
  "packageId" text NOT NULL,
  "userId" text NOT NULL,
  "rating" integer NOT NULL CHECK ("rating" >= 1 AND "rating" <= 5),
  "body" text NOT NULL DEFAULT '',
  "status" text NOT NULL DEFAULT 'unread',
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "stickerPackageReview_packageId_userId_unique" ON "stickerPackageReview" ("packageId", "userId");
CREATE INDEX "stickerPackageReview_packageId_idx" ON "stickerPackageReview" ("packageId");
CREATE INDEX "stickerPackageReview_userId_idx" ON "stickerPackageReview" ("userId");
CREATE INDEX "stickerPackageReview_packageId_status_idx" ON "stickerPackageReview" ("packageId", "status");

CREATE TABLE "creatorLaunchNotification" (
  "id" text PRIMARY KEY,
  "recipientUserId" text NOT NULL,
  "creatorId" text NOT NULL,
  "packageId" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "readAt" timestamp
);
CREATE UNIQUE INDEX "creatorLaunchNotification_recipient_package_unique" ON "creatorLaunchNotification" ("recipientUserId", "packageId");
CREATE INDEX "creatorLaunchNotification_recipient_status_created_idx" ON "creatorLaunchNotification" ("recipientUserId", "status", "createdAt");
CREATE INDEX "creatorLaunchNotification_creatorId_idx" ON "creatorLaunchNotification" ("creatorId");

CREATE TABLE "stickerFeaturedShelf" (
  "id" text PRIMARY KEY,
  "slug" text NOT NULL,
  "title" text NOT NULL,
  "status" text NOT NULL DEFAULT 'draft',
  "startsAt" timestamp,
  "endsAt" timestamp,
  "createdByUserId" text NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "stickerFeaturedShelf_slug_unique" ON "stickerFeaturedShelf" ("slug");
CREATE INDEX "stickerFeaturedShelf_status_starts_ends_idx" ON "stickerFeaturedShelf" ("status", "startsAt", "endsAt");

CREATE TABLE "stickerFeaturedShelfItem" (
  "id" text PRIMARY KEY,
  "shelfId" text NOT NULL,
  "packageId" text NOT NULL,
  "position" integer NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "stickerFeaturedShelfItem_shelf_package_unique" ON "stickerFeaturedShelfItem" ("shelfId", "packageId");
CREATE UNIQUE INDEX "stickerFeaturedShelfItem_shelf_position_unique" ON "stickerFeaturedShelfItem" ("shelfId", "position");

CREATE TABLE "currencyDisplayRate" (
  "id" text PRIMARY KEY,
  "baseCurrency" text NOT NULL,
  "quoteCurrency" text NOT NULL,
  "rate" text NOT NULL,
  "source" text NOT NULL,
  "effectiveDate" timestamp NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "currencyDisplayRate_base_quote_date_unique" ON "currencyDisplayRate" ("baseCurrency", "quoteCurrency", "effectiveDate");
CREATE INDEX "currencyDisplayRate_quote_date_idx" ON "currencyDisplayRate" ("quoteCurrency", "effectiveDate");
`)
}

export async function down(client: PoolClient) {
  await client.query(`
DROP TABLE IF EXISTS "currencyDisplayRate";
DROP TABLE IF EXISTS "stickerFeaturedShelfItem";
DROP TABLE IF EXISTS "stickerFeaturedShelf";
DROP TABLE IF EXISTS "creatorLaunchNotification";
DROP TABLE IF EXISTS "stickerPackageReview";
DROP TABLE IF EXISTS "creatorFollow";
`)
}
