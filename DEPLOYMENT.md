# Liberty Quest Content Engine — Deployment Guide

## What You're Deploying

A single Next.js app on Railway with:
- PostgreSQL database (managed by Railway)
- Two Railway Cron jobs (auto-generate + auto-publish)
- A private admin dashboard at your Railway URL

Total cost: ~$5-10/month on Railway (Hobby plan)

---

## Step 1: Get Your Facebook Page Access Token

You need a **long-lived Page access token** — not your personal token.

1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Create an app (type: Business)
3. Add the **Pages API** product
4. Go to **Tools → Graph API Explorer**
5. Select your App and your Page
6. Request permissions: `pages_manage_posts`, `pages_read_engagement`
7. Click **Generate Access Token**
8. Exchange for a long-lived token (valid ~60 days — set a reminder to renew):

```bash
curl "https://graph.facebook.com/oauth/access_token?
  grant_type=fb_exchange_token&
  client_id=YOUR_APP_ID&
  client_secret=YOUR_APP_SECRET&
  fb_exchange_token=SHORT_LIVED_TOKEN"
```

9. Get your **Page ID** from your Facebook Page → About → Page transparency

---

## Step 2: Deploy to Railway

### 2a. Push to GitHub

```bash
cd liberty-quest-content-engine
git init
git add .
git commit -m "Initial Liberty Quest Content Engine"
gh repo create liberty-quest-content-engine --private
git push -u origin main
```

### 2b. Create Railway Project

1. Go to [railway.app](https://railway.app) and sign in
2. New Project → Deploy from GitHub repo
3. Select `liberty-quest-content-engine`
4. Railway will detect Next.js and configure automatically

### 2c. Add PostgreSQL

In Railway dashboard:
1. Click **+ New** → Database → PostgreSQL
2. Railway auto-sets `DATABASE_URL` in your service environment

### 2d. Set Environment Variables

In Railway → your service → Variables, add:

```
OPENAI_API_KEY=sk-...
FACEBOOK_PAGE_ID=your_page_numeric_id
FACEBOOK_PAGE_ACCESS_TOKEN=your_long_lived_token
CRON_SECRET=generate-a-random-32-char-string
NEXT_PUBLIC_APP_URL=https://your-project.up.railway.app
```

Generate CRON_SECRET with:
```bash
openssl rand -hex 32
```

---

## Step 3: Run Database Migration

Once deployed, run the schema migration once:

```bash
# Option A: Via Railway CLI
railway run psql $DATABASE_URL < sql/schema.sql

# Option B: Copy the SQL and run it in Railway's database shell
# Railway Dashboard → PostgreSQL → Connect → Shell → paste sql/schema.sql
```

---

## Step 4: Set Up Railway Cron Jobs

In Railway dashboard → New → Cron Job (add two):

### Cron 1: Weekly Content Generation
```
Name:     Generate Content (Weekly)
Schedule: 0 9 * * 1
Command:  curl -X POST $RAILWAY_SERVICE_URL/api/cron/generate -H "Authorization: Bearer $CRON_SECRET"
```
Runs every Monday at 9 AM. Generates posts only if draft queue has < 10 posts.

### Cron 2: Daily Publishing
```
Name:     Publish Scheduled Posts (Daily)
Schedule: 0 10 * * *
Command:  curl -X POST $RAILWAY_SERVICE_URL/api/cron/publish -H "Authorization: Bearer $CRON_SECRET"
```
Runs every day at 10 AM. Publishes any posts scheduled for that time.

---

## Step 5: First Run

1. Visit your Railway URL — you'll see the Liberty Quest dashboard
2. Click **Generate 30 Posts** — takes 2-3 minutes
3. Go to **Draft Queue** — review everything
4. Click **Approve** on good posts
5. Click **Reject** on anything that misses the mark
6. Go to **Approved** tab — set schedule dates and click **Schedule**
7. Done. The daily cron will publish at the scheduled times.

---

## Weekly Workflow (Target: < 15 minutes)

Every Monday morning:
1. Check if draft queue needs refilling — click **Generate 30 Posts** if < 10 drafts
2. Spend 10 minutes reviewing new drafts — approve the good ones
3. Check calendar — make sure the next 7 days are covered
4. Done

That's it. The crons handle everything else.

---

## Renewing Your Facebook Token

Long-lived tokens expire in ~60 days. Set a calendar reminder.

When it expires:
1. Get a new short-lived token from Graph API Explorer
2. Exchange it for a long-lived token (same process as Step 1)
3. Update `FACEBOOK_PAGE_ACCESS_TOKEN` in Railway Variables
4. Railway auto-redeploys

---

## Image Workflow (V1: Manual)

In V1, images are generated as **prompts only**. To add images:

1. Copy the Image Prompt from a post in the Draft Queue
2. Generate the image using:
   - [Midjourney](https://midjourney.com) — recommended for vintage Americana style
   - [DALL-E 3](https://platform.openai.com/docs/guides/images) — OpenAI's image API
   - [Adobe Firefly](https://firefly.adobe.com)
3. Upload to Cloudinary, Imgur, or any image host
4. Paste the image URL into the post's **Image URL** field in the dashboard
5. The publisher will attach it automatically when posting

**Suggested Midjourney style keywords:**
```
vintage Americana, Reader's Digest illustration style, warm sepia tones,
Norman Rockwell inspired, 1950s advertising art, wholesome family scene,
American flag bunting, patriotic but non-political
```

---

## Troubleshooting

**Posts aren't publishing:**
- Check `FACEBOOK_PAGE_ACCESS_TOKEN` isn't expired
- Check `FACEBOOK_PAGE_ID` is the numeric page ID, not the page name
- Check Railway logs for error details

**Generation is slow:**
- Normal — GPT-4o processes one post at a time with pauses to respect rate limits
- 30 posts takes about 2-3 minutes

**Database connection errors:**
- Confirm `DATABASE_URL` is set in Railway Variables (it's auto-set if you added PostgreSQL to the same project)
- Make sure you ran the schema migration

**Cron jobs not firing:**
- Check Railway cron logs under the cron job resource
- Test manually: `curl -X POST https://your-app.railway.app/api/cron/publish -H "Authorization: Bearer YOUR_CRON_SECRET"`
