# Google OAuth Setup for LockBlip on Replit

## Setup Instructions

### Step 1: Get Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select or create a project
3. Navigate to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth 2.0 Client ID**
5. Configure the OAuth consent screen if prompted
6. Choose **Web application** as the application type
7. Add authorized JavaScript origins and redirect URIs (see Step 2 below)
8. Copy the **Client ID** and **Client Secret**

### Step 2: Add Credentials to Replit Secrets

For security, Google OAuth credentials should be stored in Replit Secrets, not in files:

1. Click the lock icon (🔒) in the left sidebar of Replit
2. Add these secrets with your actual values from Google Cloud:
   - `GOOGLE_CLIENT_ID` = `your-client-id-from-google-cloud.apps.googleusercontent.com`
   - `GOOGLE_CLIENT_SECRET` = `your-client-secret-from-google-cloud`
   - `VITE_GOOGLE_CLIENT_ID` = `your-client-id-from-google-cloud.apps.googleusercontent.com`

**⚠️ Important:** Never commit these credentials to version control!

### Step 3: Configure Authorized Origins

To allow Google OAuth to work on Replit, you need to add your Replit domain to Google's authorized origins:

1. **Find Your Replit Domain**
   - Check the webview URL or run this command in the Replit shell:
     ```bash
     echo $REPLIT_DEV_DOMAIN
     ```
   - It will look like: `https://[your-repl-id].replit.dev`

2. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com/
   - Navigate to **APIs & Services** → **Credentials**

3. **Edit Your OAuth 2.0 Client ID**
   - Click the edit icon on your OAuth 2.0 Client ID

4. **Add Authorized JavaScript Origins**
   - Add your Replit domain:
     ```
     https://[your-replit-domain].replit.dev
     ```

5. **Add Authorized Redirect URIs (optional)**
   - Add the same domain if needed:
     ```
     https://[your-replit-domain].replit.dev
     ```

6. **Save Changes**
   - Click "Save" at the bottom
   - Wait a few minutes for changes to propagate

7. **Restart the Workflow**
   - In Replit, restart the dev-server workflow
   - The Google OAuth should now work!

## Note
If you deploy this app or the Replit URL changes, you'll need to add the new URL to the authorized origins list.
