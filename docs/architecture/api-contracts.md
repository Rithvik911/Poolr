# API contracts and request correlation

Sprint 2 establishes one public contract boundary for the existing Poolr API. Application routes are mounted under `/v1`; operational probes remain public and unversioned at `/health` and `/ready`.

## Request flow

```mermaid
flowchart TD
    Client[HTTP client]
    RequestId[Request ID middleware]
    JSON[JSON parser]
    Ops[Public health and readiness]
    V1[/v1 router]
    Auth[Auth routes]
    Me[Current-user routes]
    Rides[Ride routes]
    NotFound[Not-found middleware]
    Errors[Central error handler]
    Response[JSON response with X-Request-Id]

    Client --> RequestId --> JSON
    JSON --> Ops
    JSON --> V1
    V1 --> Auth
    V1 --> Me
    V1 --> Rides
    Ops --> Response
    Auth --> Response
    Me --> Response
    Rides --> Response
    JSON -->|malformed JSON| Errors
    V1 -->|unmatched route| NotFound --> Errors
    Auth -->|AppError or unexpected error| Errors
    Me -->|AppError or unexpected error| Errors
    Rides -->|AppError or unexpected error| Errors
    Errors --> Response
```

The request-ID middleware runs before `express.json()`. This ordering ensures that parser failures, authentication failures, application errors, and successful responses all carry the same correlation header. A caller-supplied `X-Request-Id` is preserved when it is non-empty, no longer than 128 characters, and contains only letters, digits, `.`, `_`, `:`, or `-`; otherwise Poolr generates a UUID.

## Versioned routes

The central `/v1` router owns the application route tree:

| Route group | Mounted endpoints |
|---|---|
| `/v1/auth` | `POST /register`, `POST /login` |
| `/v1/me` | `GET /`, `GET /rides` |
| `/v1/rides` | `POST /`, `GET /search`, `GET /:id` |

`GET /v1/me` replaces the earlier `/auth/me` shape because the resource is the current user, while `/auth` is reserved for authentication operations. The old unversioned routes are intentionally not retained as aliases: this is a pre-release contract migration, and maintaining two route trees would allow them to drift. Requests to old paths receive the standard `404 NOT_FOUND` envelope.

## Error boundary

Expected failures are represented by the typed `AppError` class. It carries an HTTP status, a specification-defined error code, a human-readable message, and optional safe details. Controllers translate validation and domain failures into `AppError`; unexpected errors pass through unchanged so the central handler can log the real error with its request ID and return a non-sensitive `500 INTERNAL` response.

Every HTTP error uses this shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid ride data",
    "details": {},
    "requestId": "e62ce7e8-b279-4d7c-8025-e5e584260ac5"
  }
}
```

The `requestId` in the body equals the `X-Request-Id` response header. Validation details use Zod's flattened structure. Unknown internal messages and stack traces are never returned to clients. Malformed JSON is normalized to `400 VALIDATION_ERROR`, unmatched routes to `404 NOT_FOUND`, and the login limiter to `429 RATE_LIMITED` through the same handler.

## Success-contract changes

- Registration now returns `{ user, accessToken }` and authenticates the new account immediately.
- Login returns `{ user, accessToken }` without the former `success`, `message`, and `data` wrapper.
- Pickup-only search returns `{ results, truncated }`, matching the authoritative top-N search contract.
- Existing Ride create, get, and listing success shapes remain unchanged to avoid unrelated client churn.

## Operational probes

`GET /health` is a liveness probe. It deliberately does not depend on MongoDB and preserves the existing `200 { status: "ok", service: "Poolr API" }` response.

`GET /ready` is a readiness probe. In v0.1 it checks the Mongoose connection only. A connected database returns `200` with `checks.mongo: "up"`; a disconnected database returns `503 SERVICE_BUSY` through the shared error envelope with `checks.mongo: "down"`. Redis is added to readiness only from v0.5, as required by the specification.

## Compatibility and remaining work

This is a deliberate breaking migration from the pre-release unversioned paths. Clients must move to `/v1` and update error parsing to read `error.code`, `error.message`, `error.details`, and `error.requestId`. Auth registration/login and search clients must also adopt their direct success objects.

Request correlation is now present in headers, error bodies, and unexpected-error logs. Pino-based structured request logging and an injectable `Clock` remain separate v0.1 work and are not claimed by this Sprint.
