# Docmost EE Features

Custom implementation of Docmost EE features, including OIDC SSO authentication, API key management, and security settings.

## Features

- **OIDC Authentication**: Full OpenID Connect (OIDC) SSO implementation with support for Keycloak and other OIDC providers
- **Auth Provider Management**: Create and manage multiple authentication providers (OIDC, SAML placeholders)
- **API Key Management**: Generate and manage API keys for programmatic access
- **Security Settings**: Configure workspace security policies including SSO enforcement
- **User Management**: Automatic user creation and linking on SSO login

## Architecture

This module is designed to be used as a git submodule in the main Docmost repository at `apps/server/src/ee/`.

### Module Structure

```
docmost-ee/
├── ee.module.ts                 # Root EE module
├── auth-provider/               # Auth provider data access
│   ├── auth-provider.module.ts
│   └── auth-provider.repo.ts
├── oidc/                        # OIDC authentication logic
│   ├── oidc.module.ts
│   ├── oidc.controller.ts
│   └── oidc.service.ts
├── security/                    # Security & SSO management
│   ├── security.module.ts
│   ├── security.service.ts
│   ├── security.controller.ts
│   └── sso.controller.ts        # Main SSO endpoints
└── api-key/                     # API key management
    ├── api-key.module.ts
    ├── api-key.service.ts
    ├── api-key.controller.ts
    └── api-key.repo.ts
```

## OIDC SSO Implementation

### How It Works

1. **User clicks SSO login button** → Frontend navigates to `/api/sso/oidc/{providerId}/login`
2. **Server generates authorization URL** → Uses `openid-client` library to discover OIDC configuration
3. **Redirects to OIDC provider** → User authenticates with Keycloak/other provider (302 redirect)
4. **Provider redirects back** → Callback to `/api/sso/oidc/{providerId}/callback` with authorization code
5. **Server validates and exchanges code** → Gets user info (email, name, etc.)
6. **User creation/lookup** → Finds existing user or creates new one (if `allowSignup` is enabled)
7. **JWT token generation** → Creates access token using TokenService
8. **Session established** → Sets `authToken` cookie and redirects to home page

### Key Features

- **State Management**: In-memory cache for OIDC state/nonce validation (auto-expires after 10 minutes)
- **Client Caching**: OIDC clients are cached per provider to avoid repeated discovery calls
- **Proper HTTP Redirects**: All redirects use 302 status code for browser compatibility
- **Security**: PKCE-like state/nonce validation, httpOnly cookies, JWT tokens
- **Error Handling**: Comprehensive logging and graceful error redirects

### Configuration

OIDC providers are stored in the `auth_providers` table with:
- `type`: 'oidc'
- `oidc_issuer`: OIDC provider URL (e.g., `https://keycloak.example.com/realms/myrealm/`)
- `oidc_client_id`: Client ID from OIDC provider
- `oidc_client_secret`: Client secret (encrypted in production)
- `allow_signup`: Whether to create new users on first SSO login
- `is_enabled`: Whether this provider is active

### Redirect URI

The callback URL must be configured in your OIDC provider:
```
http://localhost:3000/api/sso/oidc/{providerId}/callback
```

Or for production:
```
https://yourdomain.com/api/sso/oidc/{providerId}/callback
```

## API Endpoints

### Security & SSO Management

**Create OIDC Provider** (Authenticated)
```
POST /api/sso/create
{
  "type": "oidc",
  "name": "Keycloak",
  "oidcIssuer": "https://keycloak.example.com/realms/myrealm/",
  "oidcClientId": "docmost",
  "oidcClientSecret": "your-secret",
  "allowSignup": true,
  "isEnabled": true
}
```

**List Providers** (Authenticated)
```
POST /api/sso/providers
```

**Update Provider** (Authenticated)
```
POST /api/sso/update
{
  "providerId": "xxx",
  "name": "Updated Name",
  "isEnabled": true
}
```

**Delete Provider** (Authenticated)
```
POST /api/sso/delete
{
  "providerId": "xxx"
}
```

### OIDC Login Flow

**Initiate Login** (Public)
```
GET /api/sso/oidc/{providerId}/login
→ Redirects to OIDC provider for authentication
```

**Callback** (Public)
```
GET /api/sso/oidc/{providerId}/callback?code=xxx&state=xxx
→ Validates authentication and logs user in
```

### API Key Management

**Create API Key** (Authenticated)
```
POST /api/api-keys/create
{
  "name": "My API Key",
  "expiresAt": "2025-12-31T23:59:59Z"  // optional
}
```

**List API Keys** (Authenticated)
```
POST /api/api-keys
{
  "page": 1,
  "limit": 50
}
```

**Update API Key** (Authenticated)
```
POST /api/api-keys/update
{
  "id": "xxx",
  "name": "New Name"
}
```

**Revoke API Key** (Authenticated)
```
POST /api/api-keys/revoke
{
  "id": "xxx"
}
```

## Dependencies

- `@nestjs/common`, `@nestjs/jwt`: NestJS framework
- `openid-client`: OIDC authentication
- `nestjs-kysely`, `kysely`: Database ORM
- `@docmost/db`: Docmost database types
- `fastify`: HTTP server (for redirects and cookies)

## Frontend Integration

Frontend changes required to enable EE features:

1. **Remove License Checks**: Comment out license validation in:
   - `apps/client/src/components/settings/settings-sidebar.tsx`
   - `apps/client/src/ee/security/pages/security.tsx`
   - `apps/client/src/ee/components/sso-login.tsx`

2. **SSO Login Button**: The `SsoLogin` component automatically appears when providers are configured

## Database Schema

### auth_providers Table
```sql
CREATE TABLE auth_providers (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL,
  creator_id UUID NOT NULL,
  name VARCHAR NOT NULL,
  type VARCHAR NOT NULL,  -- 'oidc', 'saml', 'google', 'ldap'
  oidc_issuer VARCHAR,
  oidc_client_id VARCHAR,
  oidc_client_secret VARCHAR,
  saml_url VARCHAR,
  saml_certificate TEXT,
  allow_signup BOOLEAN DEFAULT false,
  is_enabled BOOLEAN DEFAULT false,
  group_sync BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);
```

### auth_accounts Table
```sql
CREATE TABLE auth_accounts (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  auth_provider_id UUID NOT NULL,
  provider_user_id VARCHAR NOT NULL,  -- OIDC 'sub' claim
  workspace_id UUID NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);
```

## Testing OIDC with Keycloak

### Keycloak Configuration

1. Create a new client in Keycloak:
   - Client ID: `docmost`
   - Client Protocol: `openid-connect`
   - Access Type: `confidential`
   - Valid Redirect URIs: `http://localhost:3000/api/sso/oidc/*/callback`

2. Get client secret from Credentials tab

3. In Docmost, create OIDC provider:
   - Name: `Keycloak`
   - Issuer: `https://keycloak.example.com/realms/yourrealm/`
   - Client ID: `docmost`
   - Client Secret: `[from Keycloak]`
   - Allow Signup: `true` (for new users)
   - Is Enabled: `true`

### Testing Flow

1. Navigate to Docmost login page
2. Click "Keycloak" SSO button
3. Authenticate in Keycloak
4. Automatically redirected back to Docmost and logged in

Check Docker logs for detailed flow:
```bash
docker logs -f docmost-docmost-1
```

## Troubleshooting

### Common Issues

**Blank page after clicking SSO button**
- Check if redirect returns 302 status (not 200)
- Verify redirect URL in browser Network tab
- Check `APP_URL` environment variable matches your domain

**"Invalid state" error**
- State expired (>10 minutes) - try again
- Multiple browser tabs/sessions - close and retry
- Server restarted between login and callback - restart flow

**"Signup not allowed" error**
- Set `allow_signup: true` in provider configuration
- Or create user manually first with same email

**"secretOrPrivateKey must have a value" error**
- Ensure `APP_SECRET` is set in environment variables
- Minimum 32 characters required
- Check Docker container has environment variable set

**OIDC provider not showing on login page**
- Verify `is_enabled: true` in database
- Check provider is in correct workspace
- Clear browser cache and reload

### Enable Debug Logging

Set in `.env`:
```
DEBUG_MODE=true
```

Watch logs:
```bash
docker logs -f docmost-docmost-1 | grep -i oidc
```

## Development

### Building

This module is compiled as part of the main Docmost build:
```bash
cd docmost
npm run build
```

### Docker

To rebuild Docker image with EE changes:
```bash
cd docmost
docker build -t docmost:latest .
docker-compose down
docker-compose up -d
```

## Security Considerations

1. **Client Secrets**: Store `oidc_client_secret` encrypted in production
2. **HTTPS Only**: Always use HTTPS in production for cookie security
3. **State Validation**: OIDC state/nonce prevents CSRF attacks
4. **JWT Secrets**: Use strong `APP_SECRET` (32+ random characters)
5. **Cookie Settings**: httpOnly cookies prevent XSS attacks
6. **Rate Limiting**: Consider adding rate limits to login endpoints

## License

This is a custom implementation for self-hosted Docmost. Use in accordance with Docmost's AGPL 3.0 license.

## Credits

Developed as a custom enterprise feature implementation for self-hosted Docmost with OIDC SSO support.
