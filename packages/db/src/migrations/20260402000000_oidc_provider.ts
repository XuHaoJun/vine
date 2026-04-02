import type { PoolClient } from 'pg'

const sql = `
CREATE TABLE "oauthApplication" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "icon" text,
  "metadata" text,
  "clientId" text NOT NULL UNIQUE,
  "clientSecret" text,
  "redirectUrls" text NOT NULL,
  "type" text NOT NULL,
  "disabled" boolean DEFAULT false,
  "userId" text REFERENCES "user"("id") ON DELETE CASCADE,
  "createdAt" timestamp NOT NULL,
  "updatedAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauthAccessToken" (
  "id" text PRIMARY KEY,
  "accessToken" text NOT NULL UNIQUE,
  "refreshToken" text NOT NULL UNIQUE,
  "accessTokenExpiresAt" timestamp NOT NULL,
  "refreshTokenExpiresAt" timestamp NOT NULL,
  "clientId" text NOT NULL REFERENCES "oauthApplication"("clientId") ON DELETE CASCADE,
  "userId" text REFERENCES "user"("id") ON DELETE CASCADE,
  "scopes" text NOT NULL,
  "createdAt" timestamp NOT NULL,
  "updatedAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauthConsent" (
  "id" text PRIMARY KEY,
  "clientId" text NOT NULL REFERENCES "oauthApplication"("clientId") ON DELETE CASCADE,
  "userId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "scopes" text NOT NULL,
  "createdAt" timestamp NOT NULL,
  "updatedAt" timestamp NOT NULL,
  "consentGiven" boolean NOT NULL DEFAULT false
);
--> statement-breakpoint
CREATE INDEX "oauthApplication_userId_idx" ON "oauthApplication" ("userId");
--> statement-breakpoint
CREATE INDEX "oauthAccessToken_clientId_idx" ON "oauthAccessToken" ("clientId");
--> statement-breakpoint
CREATE INDEX "oauthAccessToken_userId_idx" ON "oauthAccessToken" ("userId");
--> statement-breakpoint
CREATE INDEX "oauthConsent_clientId_idx" ON "oauthConsent" ("clientId");
--> statement-breakpoint
CREATE INDEX "oauthConsent_userId_idx" ON "oauthConsent" ("userId");
--> statement-breakpoint
INSERT INTO "oauthApplication" (
  "id", "name", "clientId", "clientSecret", "redirectUrls",
  "type", "disabled", "createdAt", "updatedAt"
) VALUES (
  'vine-dev-client-001',
  'Vine Dev Test App',
  'vine-dev-client',
  'vine-dev-secret',
  'http://localhost:8081/auth/oauth-callback',
  'web',
  false,
  NOW(),
  NOW()
);
`

export async function up(client: PoolClient) {
  await client.query(sql)
}
