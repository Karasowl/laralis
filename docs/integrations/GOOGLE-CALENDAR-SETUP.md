# Google Calendar Integration Setup Guide

This guide walks you through setting up Google Calendar integration for Laralis. The integration allows your dental clinic to automatically sync appointments to Google Calendar.

## Prerequisites

- A Google account (personal or Google Workspace)
- Access to [Google Cloud Console](https://console.cloud.google.com/)
- Admin access to your Laralis installation

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click the project dropdown at the top of the page
3. Click **New Project**
4. Enter a project name (e.g., "Laralis Dental App")
5. Click **Create**
6. Wait for the project to be created, then select it from the dropdown

## Step 2: Enable Google Calendar API

1. In the Google Cloud Console, go to **APIs & Services** > **Library**
2. Search for "Google Calendar API"
3. Click on **Google Calendar API**
4. Click **Enable**

## Step 3: Configure OAuth Consent Screen

1. Go to **APIs & Services** > **OAuth consent screen**
2. Choose **External** (or **Internal** if using Google Workspace)
3. Click **Create**
4. Fill in the required fields:
   - **App name**: "Laralis" (or your clinic name)
   - **User support email**: Your email address
   - **Developer contact information**: Your email address
5. Click **Save and Continue**

### Add Scopes

1. Click **Add or Remove Scopes**
2. Search for and select these scopes:
   - `https://www.googleapis.com/auth/calendar.events`
   - `https://www.googleapis.com/auth/calendar.readonly`
   - `https://www.googleapis.com/auth/userinfo.email`
3. Click **Update**
4. Click **Save and Continue**

### Add Test Users (for External apps)

1. Click **Add Users**
2. Add the Google accounts that will test the integration
3. Click **Save and Continue**
4. Review and click **Back to Dashboard**

## Step 4: Create OAuth Credentials

1. Go to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **OAuth client ID**
3. Select **Web application**
4. Enter a name (e.g., "Laralis Web Client")
5. Under **Authorized redirect URIs**, add:
   - For development: `http://localhost:3000/api/auth/google-calendar/callback`
   - For production: `https://yourdomain.com/api/auth/google-calendar/callback`
6. Click **Create**
7. A dialog will show your **Client ID** and **Client Secret**
8. **Copy both values** - you'll need them for configuration

## Step 5: Configure Environment Variables

Add these variables to your `.env.local` file:

```env
# Google Calendar Integration
GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret-here
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google-calendar/callback
```

For production, update `GOOGLE_REDIRECT_URI` to your production URL.

## Step 6: Connect in Laralis

1. Log in to Laralis
2. Go to **Settings** > **Integrations**
3. Find the Google Calendar section
4. Click **Connect Google Calendar**
5. Sign in with your Google account
6. Grant the requested permissions
7. Select which calendar to sync appointments to
8. Click **Connect**

## Verification

After connecting:
1. Create a new treatment with status "scheduled" or "pending"
2. Check your Google Calendar - the appointment should appear
3. The event will show the patient name and service

## Troubleshooting

### "Access Denied" Error

**Cause**: App is in testing mode and user is not added as a test user.

**Solution**:
1. Go to Google Cloud Console > OAuth consent screen
2. Add the user to the test users list
3. Or publish the app (requires verification for some scopes)

### "Redirect URI Mismatch" Error

**Cause**: The redirect URI in your request doesn't match what's configured.

**Solution**:
1. Go to Credentials in Google Cloud Console
2. Edit your OAuth client
3. Verify the redirect URI matches exactly:
   - Include the protocol (`http://` or `https://`)
   - Include the port for localhost (`:3000`)
   - Match the path exactly (`/api/auth/google-calendar/callback`)

### Calendar Events Not Appearing

**Possible causes**:
1. **Token expired**: Try disconnecting and reconnecting
2. **Wrong calendar selected**: Check calendar settings
3. **Status not syncable**: Only `pending`, `scheduled`, and `in_progress` statuses sync

**Check sync status**:
- Look at the API response when creating/updating treatments
- The `calendarSync` field shows success or error details

### "Token Refresh Failed" Error

**Cause**: Refresh token is invalid or revoked.

**Solution**:
1. Go to Settings > Integrations
2. Click **Disconnect**
3. Click **Connect** again to re-authorize

## Production Deployment

For production use:

1. **Verify your app** (if using sensitive scopes):
   - Go to OAuth consent screen
   - Click **Publish App**
   - Complete the verification process

2. **Update redirect URIs**:
   - Add your production domain to Authorized redirect URIs

3. **Set environment variables**:
   - Update `GOOGLE_REDIRECT_URI` to your production URL

## Security Notes

- **Never commit** `.env.local` to version control
- Client secrets should be kept confidential
- Use HTTPS in production
- Regularly review connected apps in your Google Account security settings

## Sync Behavior

### Which treatments sync?
- Status: `pending`, `scheduled`, or `in_progress`
- Treatments with `completed` or `cancelled` status are removed from calendar

### Event Details
- **Title**: `{Patient Name} - {Service Name}`
- **Description**: "Cita dental - {Service Name}"
- **Duration**: Uses the treatment's `duration_minutes` field
- **Timezone**: America/Mexico_City (configurable)

### Automatic Updates
- Changing treatment date/time updates the calendar event
- Changing status to `completed` or `cancelled` removes the event
- Deleting a treatment removes the event

## Support

If you encounter issues not covered here:
1. Check the browser console for errors
2. Check the server logs for API errors
3. Report issues at: https://github.com/anthropics/claude-code/issues
