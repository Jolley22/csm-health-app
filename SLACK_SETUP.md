# Monthly Slack Survey Reminder - Setup Guide

This guide walks you through setting up automated monthly Slack notifications for CSM surveys.

## Overview

On the 1st of each month at 9:00 AM UTC, GitHub Actions will:
1. Fetch all active customers from Supabase
2. Generate personalized survey links for each CSM
3. Post a message to your Slack channel with buttons for each CSM

## Setup Steps

### Step 1: Create a Slack Incoming Webhook (Free)

1. Go to [Slack API Apps](https://api.slack.com/apps)
2. Click **Create New App** → **From scratch**
3. Name it something like "CSM Survey Bot" and select your workspace
4. In the left sidebar, click **Incoming Webhooks**
5. Toggle **Activate Incoming Webhooks** to ON
6. Click **Add New Webhook to Workspace**
7. Select the channel where you want survey reminders posted (e.g., `#csm-team`)
8. Click **Allow**
9. Copy the **Webhook URL** (it starts with `https://hooks.slack.com/services/...`)

### Step 2: Add GitHub Secrets

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Add these secrets by clicking **New repository secret**:

| Secret Name | Value |
|-------------|-------|
| `SUPABASE_URL` | Your Supabase project URL (from supabaseClient.js) |
| `SUPABASE_ANON_KEY` | Your Supabase anon key (from supabaseClient.js) |
| `SLACK_WEBHOOK_URL` | The webhook URL from Step 1 |
| `APP_BASE_URL` | Your deployed app URL (e.g., `https://your-app.vercel.app`) |

### Step 3: Push to GitHub

```bash
git add .
git commit -m "Add monthly Slack survey reminders"
git push origin master
```

### Step 4: Test the Workflow

1. Go to your GitHub repository
2. Click **Actions** tab
3. Click **Monthly CSM Survey Reminder** workflow
4. Click **Run workflow** → **Run workflow** (manual trigger)
5. Check your Slack channel for the message!

## Optional: Add @mentions for CSMs

To @mention specific team members in Slack:

1. In Slack, click on a team member's profile
2. Click the **...** (More) button
3. Click **Copy member ID**
4. Edit `scripts/send-survey-reminders.js` and add the IDs:

```javascript
const CSM_SLACK_IDS = {
  'Brooke': 'U01ABC123',
  'Natalie': 'U02DEF456',
  'Ryan': 'U03GHI789',
  // ... add all your team members
};
```

## Customizing the Schedule

The workflow runs at 9:00 AM UTC on the 1st of each month. To change this:

Edit `.github/workflows/monthly-survey-reminder.yml`:

```yaml
on:
  schedule:
    # Format: minute hour day month weekday
    - cron: '0 9 1 * *'  # 9 AM UTC on the 1st
    # Examples:
    # '0 14 1 * *'  # 2 PM UTC on the 1st
    # '0 9 15 * *'  # 9 AM UTC on the 15th
    # '0 9 1,15 * *'  # 9 AM UTC on 1st and 15th
```

## What the Slack Message Looks Like

```
┌────────────────────────────────────────────────┐
│  Customer Health Survey - January 2026         │
│                                                │
│  Hey team! It's time for the monthly Customer  │
│  Health Score survey. Please complete your     │
│  survey by the end of the week.                │
│                                                │
│  ─────────────────────────────────────────     │
│                                                │
│  *Brooke* - 12 customers    [Start Survey]     │
│  *Natalie* - 8 customers    [Start Survey]     │
│  *Ryan* - 15 customers      [Start Survey]     │
│  ...                                           │
│                                                │
│  ─────────────────────────────────────────     │
│  Survey links are personalized for each CSM.   │
└────────────────────────────────────────────────┘
```

## Troubleshooting

### Workflow not running?
- Check that the repository has GitHub Actions enabled
- Verify all secrets are set correctly (no extra spaces)
- Try the manual trigger to test

### Slack message not posting?
- Verify the webhook URL is correct
- Check the GitHub Actions logs for errors
- Make sure the webhook is still active in Slack

### No customers showing?
- Verify `is_active` is set to `true` for customers in Supabase
- Check that customers have a `csm` value assigned

## Cost

**$0/month** - This solution is completely free:
- GitHub Actions: Free for public repos, 2000 minutes/month for private repos
- Slack Incoming Webhooks: Free
- Supabase: Free tier includes plenty for this use case
