# NGROK Configuration Guide

When using NGROK to expose your WAF frontend service, you need to update the domain configuration across multiple components.

## Quick Setup with Script

Use the automated script to update all configurations at once:

```bash
./scripts/update-domain.sh https://your-new-domain.ngrok-free.app
```

This script automatically updates:
- Local configuration files
- Kubernetes deployments
- Backend application settings

## Manual Configuration

If you prefer to update manually, modify these locations:

### 1. Local Configuration Files
- `.env` (lines 24-25): Main environment configuration
- `backend/waf-social-api/src/main/resources/application.yml` (lines 16, 23-24): Backend defaults

### 2. Kubernetes Deployments
- `waf-social-api` deployment environment variables:
  - `OAUTH_CALLBACK_BASE_URL`
  - `OAUTH_DEFAULT_REDIRECT_URL`
  - `GOOGLE_OAUTH_REDIRECT_URI`
  - `COOKIE_DOMAIN`

## Google OAuth Setup

After updating the domain, you **must** update your Google OAuth configuration:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Credentials** → **OAuth 2.0 Client IDs**
3. Update **Authorized redirect URIs** to include:
   ```
   https://your-new-domain.ngrok-free.app/login/oauth2/code/google
   ```

## Verification

After updating the configuration:

1. Check backend configuration:
   ```bash
   curl http://localhost:8081/auth/debug/callback-base-url
   ```

2. Test Google login flow through the frontend

## Common Issues

- **Authentication fails**: Ensure Google OAuth redirect URI is updated
- **Backend not accessible**: Check if Kubernetes port-forward is running
- **Old domain still showing**: Restart the `waf-social-api` pod

## Example

```bash
# Update to new NGROK domain
./scripts/update-domain.sh https://c32ce51863b1.ngrok-free.app

# Verify the update
curl http://localhost:8081/auth/debug/callback-base-url
```