# Authentication architecture

This document describes the authentication implementation currently present in Poolr. It covers registration, login, JWT-protected profile access, environment validation, and login rate limiting. Cross-cutting `/v1` routing, request IDs, and error-envelope behavior are documented in [API contracts and request correlation](api-contracts.md).

## System overview

```mermaid
flowchart LR
    Client[HTTP client]

    subgraph API[Poolr Express API]
        JSON[express.json]
        Router[Auth router]
        LoginLimit[Login rate limiter\n10 requests / 15 minutes / IP\nin-memory store]
        AuthGuard[requireAuth middleware]
        Controller[Auth controllers]
        Validator[Zod schemas]
        Service[Auth service]
        JWT[JWT utility\nHS256, 60-minute access token]
    end

    Bcrypt[bcrypt]
    Mongo[(MongoDB users collection)]
    Env[Validated environment\nMONGO_URI and JWT_SECRET]

    Client --> JSON --> Router
    Router -->|POST /v1/auth/register| Controller
    Router -->|POST /v1/auth/login| LoginLimit --> Controller
    Router -->|GET /v1/me| AuthGuard --> Controller
    Controller --> Validator
    Controller --> Service
    Controller -->|profile lookup| Mongo
    Service --> Bcrypt
    Service --> Mongo
    Service --> JWT
    AuthGuard --> JWT
    JWT --> Env
    Mongo --> Env
```

The Express application assigns a request ID, installs JSON parsing, and then mounts the coordinated router under `/v1`. The router applies authentication middleware at the individual route level:

| Route | Middleware and handler order | Purpose |
|---|---|---|
| `POST /v1/auth/register` | `registerController` | Validate input, hash the password, create a user, and return an access token. |
| `POST /v1/auth/login` | `loginRateLimiter` → `loginController` | Enforce the per-IP request allowance before validation or credential work. |
| `GET /v1/me` | `requireAuth` → `getMeController` | Verify a bearer access token before loading the current user. |

At process startup, `validateEnv()` requires a non-empty `MONGO_URI` and a `JWT_SECRET` of at least 32 characters before the database connection is opened or the HTTP server starts listening. JWT signing and verification also reject a missing or short secret at the point of use.

## Registration sequence

```mermaid
sequenceDiagram
    autonumber
    actor Client
    participant Router as Auth router
    participant Controller as registerController
    participant Schema as registerSchema
    participant Service as registerUser
    participant Bcrypt as bcrypt
    participant Mongo as MongoDB / UserModel

    Client->>Router: POST /v1/auth/register
    Router->>Controller: request
    Controller->>Schema: safeParse(body)
    alt Invalid input
        Schema-->>Controller: validation errors
        Controller-->>Client: 400 Invalid registration data
    else Valid input
        Schema-->>Controller: normalized input
        Controller->>Service: registerUser(input)
        Service->>Mongo: findOne({ email })
        alt Email already exists
            Mongo-->>Service: existing user
            Service-->>Controller: EmailAlreadyExistsError
            Controller-->>Client: 409 Email already registered
        else Email is available
            Service->>Bcrypt: hash(password, 12)
            Bcrypt-->>Service: passwordHash
            Service->>Mongo: create(name, email, passwordHash)
            Mongo-->>Service: user document
            Service-->>Controller: token and safe user fields
            Controller-->>Client: 201 { user, accessToken }
        end
    end
```

Registration trims and constrains the name, normalizes the email to trimmed lowercase, requires a password of at least eight characters, and rejects passwords longer than 72 UTF-8 bytes. The service uses bcrypt with cost factor 12. The Mongoose model excludes `passwordHash` from normal queries, and the response contains `{ user, accessToken }`; the user object exposes only the ID, name, email, and driver capability. A MongoDB duplicate-key error on the email index is translated to `409 EMAIL_TAKEN`, covering a race between the preliminary lookup and insertion.

## Login sequence

```mermaid
sequenceDiagram
    autonumber
    actor Client
    participant Limiter as loginRateLimiter
    participant Store as In-memory counter store
    participant Controller as loginController
    participant Schema as loginSchema
    participant Service as loginUser
    participant Mongo as MongoDB / UserModel
    participant Bcrypt as bcrypt
    participant JWT as generateAccessToken

    Client->>Limiter: POST /v1/auth/login
    Limiter->>Store: increment counter for client IP
    alt More than 10 requests in 15 minutes
        Store-->>Limiter: limit exceeded
        Limiter-->>Client: 429 Too many login attempts
    else Request is within the allowance
        Limiter->>Controller: next()
        Controller->>Schema: safeParse(body)
        alt Invalid input
            Schema-->>Controller: validation errors
            Controller-->>Client: 400 Invalid login data
        else Valid input
            Schema-->>Controller: normalized input
            Controller->>Service: loginUser(input)
            Service->>Mongo: findOne({ email }).select(+passwordHash)
            alt User is missing
                Mongo-->>Service: no user
                Service->>Bcrypt: compare(password, dummy hash)
                Bcrypt-->>Service: false
                Service-->>Controller: InvalidCredentialsError
                Controller-->>Client: 401 Invalid email or password
            else User exists
                Mongo-->>Service: user with passwordHash
                Service->>Bcrypt: compare(password, passwordHash)
                alt Password does not match
                    Bcrypt-->>Service: false
                    Service-->>Controller: InvalidCredentialsError
                    Controller-->>Client: 401 Invalid email or password
                else Password matches
                    Bcrypt-->>Service: true
                    Service->>JWT: sign({ userId }, JWT_SECRET, HS256, 60m)
                    JWT-->>Service: access token
                    Service-->>Controller: token and safe user fields
                    Controller-->>Client: 200 { user, accessToken }
                end
            end
        end
    end
```

The limiter is created by `createLoginRateLimiter(limit = 10)` from `express-rate-limit`. Its fixed window is 15 minutes, it uses the library's default in-memory store and default IP-based keying, emits the combined draft-8 `RateLimit` header, disables legacy `X-RateLimit-*` headers, and forwards `429 RATE_LIMITED` to the central error handler. The tenth request is allowed; the eleventh request from the same resolved IP during the window receives HTTP 429.

Because the limiter precedes `loginController`, every request reaching the login route counts, including malformed requests that later receive HTTP 400. A blocked request never reaches Zod validation, MongoDB, bcrypt, or JWT signing.

When the email is not registered, the service compares the supplied password against a fixed dummy bcrypt hash before returning the generic credential error. Existing users use their stored hash. Both failure paths therefore perform one cost-12 bcrypt comparison, removing the large timing difference that would otherwise disclose whether an email exists.

## Protected profile sequence

```mermaid
sequenceDiagram
    autonumber
    actor Client
    participant Guard as requireAuth
    participant JWT as jsonwebtoken.verify
    participant Controller as getMeController
    participant Mongo as MongoDB / UserModel

    Client->>Guard: GET /v1/me with Authorization header
    alt Header is missing or not exactly Bearer token
        Guard-->>Client: 401
    else Header format is valid
        Guard->>JWT: verify(token, JWT_SECRET, HS256)
        alt Token is invalid, expired, or has no string userId
            JWT-->>Guard: verification failure or invalid payload
            Guard-->>Client: 401
        else Token is valid
            JWT-->>Guard: payload with userId
            Guard->>Controller: set res.locals.userId and next()
            Controller->>Mongo: findById(userId)
            alt User no longer exists
                Mongo-->>Controller: no user
                Controller-->>Client: 404 User not found
            else User exists
                Mongo-->>Controller: user
                Controller-->>Client: 200 with id, name, and email
            end
        end
    end
```

Access tokens are signed with HS256 and expire after 60 minutes. `requireAuth` accepts exactly one `Bearer <token>` credential, pins verification to HS256, validates that the decoded payload contains a string `userId`, and passes that ID through `res.locals`. There is currently no refresh-token, revocation, or logout mechanism.

## Rate-limiter construction and placement

`createLoginRateLimiter()` is a factory rather than only a singleton. Production exports `loginRateLimiter = createLoginRateLimiter()` with the default limit of 10. Focused tests create a fresh limiter with a small limit for each test, preventing counters from leaking between cases and keeping the tests fast. The real-route integration test uses the production singleton and verifies ten HTTP 400 responses followed by one HTTP 429 response.

The limiter is intentionally narrow in scope: it protects only `POST /v1/auth/login`. Registration, `/v1/me`, health checks, and any future routes are not affected by this middleware instance.

## Error and response boundaries

- Registration validation failures return HTTP 400; duplicate emails return HTTP 409.
- Login validation failures return HTTP 400; unknown email and wrong password deliberately share the generic HTTP 401 response `Invalid email or password`.
- Login throttling returns HTTP 429 with the shared `RATE_LIMITED` error envelope.
- Unexpected registration or login failures return `500 INTERNAL` without exposing internal error details in the response.
- Every error includes an `X-Request-Id` header and the same ID in `error.requestId`.
- Missing, malformed, invalid, or expired credentials on `/v1/me` return HTTP 401; a valid token for a deleted user returns HTTP 404.

## Verification

The Sprint 2 verification baseline is 139 passing tests across 13 files. Production and test TypeScript checks pass, and overall coverage is 89.82% statements/lines, 85.29% branches, and 95% functions.

The rate-limiter tests verify:

- requests at the configured limit are allowed;
- the next request returns HTTP 429 and the expected JSON body;
- the standard `RateLimit` response header is present; and
- the production `/v1/auth/login` route counts malformed requests before controller validation and blocks request 11.

## Current limitations

- The default in-memory store is local to one Node.js process. Counters reset on restart and are not shared across replicas, so the effective allowance increases when traffic is distributed across multiple instances.
- IP-based limiting can group users behind the same NAT and can be evaded by attackers able to rotate source addresses.
- Correct client identification depends on Express proxy configuration matching the deployment topology. `trust proxy` is not configured in the current application.
- The limiter protects the endpoint, not an account identifier. It does not implement progressive delays, CAPTCHA, account lockout, or risk-based controls.
- The middleware counts all login requests, including malformed requests and successful logins; it does not reset a client's counter after successful authentication.
- There is no external store, cross-process coordination, fail-open/fail-closed policy, or limiter observability yet.
- Rate limiting reduces online guessing volume but does not replace strong passwords, secure secret management, monitoring, or broader abuse controls.

