---
name: connect
description: |
  ConnectRPC (connect-es v2) workflow for this turborepo. Use when working with:
  - Adding a new ConnectRPC service (from proto definition to implementation)
  - Implementing service handlers (server-side)
  - Creating clients to call ConnectRPC services (web/client-side)
  - Proto file definitions and code generation
  - @connectrpc/connect, @connectrpc/connect-web, @connectrpc/connect-node
  - The turbo task `proto:generate` for generating TypeScript from .proto files
  Trigger whenever user mentions "connectrpc", "connect", "proto", "service", or wants to add a new RPC endpoint.
---

# ConnectRPC Workflow

## Overview

ConnectRPC workflow in this repo:

```
1. Define proto     →  2. Generate code     →  3. Implement server  →  4. Use client
packages/proto/proto/   bun turbo proto:generate   apps/server/src/connect/   apps/web/src/features/auth/client/
```

## Key File Locations

### Proto Definition & Generation
| Purpose | Path |
|---------|------|
| Proto definitions | `packages/proto/proto/<service>/<version>/<name>.proto` |
| Generated TS code | `packages/proto/gen/<service>/<version>/` |
| Generate command | `bun turbo proto:generate` |
| Generation config | `packages/proto/buf.gen.yaml` |

### Server Implementation
| Purpose | Path |
|---------|------|
| Service handlers | `apps/server/src/connect/<service>.ts` |
| Route registration | `apps/server/src/connect/routes.ts` |
| Server entry | `apps/server/src/index.ts` |

### Client (Web)
| Purpose | Path |
|---------|------|
| Transport config | `apps/web/src/features/auth/client/connectTransport.ts` |
| Client usage | Import from `@vine/proto` |

## Workflow: Adding a New Service

### Step 1: Create Proto Definition

Create `packages/proto/proto/<service>/<version>/<name>.proto`:

```protobuf
syntax = "proto3";

package <service>.<version>;

import "google/protobuf/timestamp.proto";

message <Request> {
  string name = 1;
}

message <Response> {
  string message = 1;
  google.protobuf.Timestamp created_at = 2;
}

service <Service>Service {
  rpc <Method>(<Request>) returns (<Response>);
}
```

### Step 2: Generate Code

```bash
bun turbo proto:generate
```

This generates in `packages/proto/gen/`:
- `<name>_pb.ts` - Message types (protobuf)
- `<name>_connect.ts` - Client stub (only if using @bufbuild/protobuf ^2.0.0)

### Step 3: Implement Server Handler

Create `apps/server/src/connect/<service>.ts`:

```typescript
import type { HandlerContext } from "@connectrpc/connect";
import type { <Service>Service } from "@vine/proto";
import { <Service> } from "@vine/proto/gen/<service>/<version>/<name>_pb";
import { SayRequest, SayResponse } from "@vine/proto/gen/<service>/<version>/<name>_pb";

export function create<Service>Handler(): Partial<Service> {
  return {
    <method>(req: SayRequest, context: HandlerContext): Promise<SayResponse> {
      return Promise.resolve(
        new SayResponse({
          message: `Hello ${req.name}!`,
        })
      );
    },
  };
}
```

Register in `apps/server/src/connect/routes.ts`:

```typescript
import { ConnectRouter } from "@connectrpc/connect";
import { <Service> } from "@vine/proto/gen/<service>/<version>/<name>_pb";
import { create<Service>Handler } from "./<service>";

export default (router: ConnectRouter) => {
  router.service(<Service>, create<Service>Handler());
};
```

### Step 4: Use Client (Web)

```typescript
import { createPromiseClient } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";
import { <Service> } from "@vine/proto/gen/<service>/<version>/<name>_connect";

const transport = createConnectTransport({
  baseUrl: "https://api.example.com",
});

const client = createPromiseClient(<Service>, transport);

const response = await client.<method>({ name: "World" });
```

## Proto Package Exports

`packages/proto/package.json` exports:
```json
{
  ".": "./gen/greeter/v1/greeter_pb.ts",
  "./greeter": "./gen/greeter/v1/greeter_pb.ts"
}
```

For a new service `<service>`, add export:
```json
"./<service>": "./gen/<service>/<version>/<name>_pb.ts"
```

## Protocol Support

The `ConnectRouter` automatically supports three protocols:
- **Connect** - Primary protocol, JSON or binary
- **gRPC** - Binary format only
- **gRPC-Web** - For browser clients

## Reference Files

- Greeter example: `apps/server/src/connect/greeter.ts`
- Routes: `apps/server/src/connect/routes.ts`
- Web transport: `apps/web/src/features/auth/client/connectTransport.ts`
- Proto definition: `packages/proto/proto/greeter/v1/greeter.proto`
