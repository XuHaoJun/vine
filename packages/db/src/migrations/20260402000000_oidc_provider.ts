import type { PoolClient } from 'pg'

const DEFAULT_INTEGRATION_TEST_PROXY_PORT = 8081

function getIntegrationTestProxyPort() {
  const parsedPort = Number(process.env.INTEGRATION_TEST_PROXY_PORT)
  if (Number.isInteger(parsedPort) && parsedPort > 0) {
    return parsedPort
  }
  return DEFAULT_INTEGRATION_TEST_PROXY_PORT
}

function getSql() {
  const oauthCallbackUrl = `http://localhost:${getIntegrationTestProxyPort()}/auth/oauth-callback`

  return `
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
  "refreshToken" text UNIQUE,
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
  -- dev-only plaintext secret (not a real credential)
  'vine-dev-secret',
  '${oauthCallbackUrl}',
  'web',
  false,
  NOW(),
  NOW()
);
`
}

export async function up(client: PoolClient) {
  await client.query(getSql())
}

export async function down(client: PoolClient) {
  await client.query(`
    DROP TABLE IF EXISTS "oauthConsent";
    DROP TABLE IF EXISTS "oauthAccessToken";
    DROP TABLE IF EXISTS "oauthApplication";
  `)
}
