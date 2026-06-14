# Railway Cron Job Setup Guide

Three cron jobs run the Liberty Quest automation pipeline end to end:

1. **Generate** — fills the draft queue with fresh content daily
2. **Schedule** — promotes drafts to scheduled posts (runs every 6 hours)
3. **Publish** — fires any post whose scheduled time has arrived (runs every 30 min)

---

## Prerequisites

Before setting up any cron job, make sure these environment variables are set on your **app service** in Railway (not the Postgres service):

| Variable | Value |
|----------|-------|
| `CRON_SECRET` | Any long random string — e.g. `openssl rand -hex 32` in your terminal. All three crons use this same secret. |
| `NEXT_PUBLIC_APP_URL` | The public URL Railway assigned your app, e.g. `https://liberty-quest-production.up.railway.app`. No trailing slash. |

---

## How to create a cron job in Railway

Railway cron jobs are set up as **separate services** in your project, not as part of the app service itself.

1. Open your Railway project dashboard.
2. Click **+ New** → **Empty service**.
3. In the new service, go to **Settings** → rename it to something clear (e.g. `cron-generate`).
4. Click **Deploy** → **Cron Job**.
5. Set the **Schedule** (cron expression) and **Command** as shown below for each job.
6. Click **Deploy**.

That's it — Railway will run the command on the schedule you set, in a fresh container each time.

> **Note:** Railway cron jobs run in UTC. The times below are given in UTC and converted to Eastern for reference.

---

## Job 1: Generate

**Purpose:** Checks the draft queue each morning. If it has fewer than 21 posts (a 7-day buffer at 3 posts/day), it generates a new batch of up to 42 posts using GPT-4o and saves them as drafts.

**Schedule:** `0 7 * * *`
Runs daily at 7:00 AM UTC (3:00 AM Eastern / 12:00 AM Pacific).

**Command:**
```
curl -X POST $NEXT_PUBLIC_APP_URL/api/cron/generate \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json"
```

**What to expect in the logs:**
- If the queue is healthy: `{"skipped":true,"reason":"Draft queue has 24 posts — no generation needed"}`
- If it generated content: `{"success":true,"generated":21,"errors":0,"draftCountBefore":3}`

**Heads up:** This job can take 3–5 minutes when it actually generates content (GPT-4o calls + image fetches + DB writes). Railway sets a default timeout of 5 minutes on cron jobs — if you see timeouts, go to the cron service settings and bump **Max Duration** to 300 seconds.

---

## Job 2: Schedule

**Purpose:** Every 6 hours, looks at the next 7 days and fills any empty posting slots with draft posts. Posting slots are 9 AM, 1 PM, and 5 PM Eastern (13:00, 17:00, 21:00 UTC). Drafts are promoted to `scheduled` status automatically — no manual approval needed.

**Schedule:** `0 */6 * * *`
Runs at 12:00 AM, 6:00 AM, 12:00 PM, and 6:00 PM UTC.

**Command:**
```
curl -X POST $NEXT_PUBLIC_APP_URL/api/cron/schedule \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json"
```

**What to expect in the logs:**
- Slots already full: `{"scheduled":0,"message":"All 21 slots filled for the next 7 days"}`
- Successfully scheduled: `{"scheduled":5,"slotsAvailable":5,"postsAvailable":18,"results":[...]}`
- No posts to schedule: `{"scheduled":0,"message":"No draft or approved posts available — run generate cron first","emptySlotsAvailable":5}`

**Note:** This job is idempotent — running it twice in a row is safe. It only fills empty slots and never touches posts that are already scheduled.

---

## Job 3: Publish

**Purpose:** Every 30 minutes, checks for posts with `status = 'scheduled'` and `scheduled_for <= NOW()`. Publishes each due post to Facebook via the Graph API and marks it `published`.

**Schedule:** `*/30 * * * *`
Runs at :00 and :30 past every hour, all day.

**Command:**
```
curl -X POST $NEXT_PUBLIC_APP_URL/api/cron/publish \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json"
```

**What to expect in the logs:**
- Nothing due: `{"published":0,"message":"No posts due"}`
- Posts published: `{"published":2,"failed":0,"results":[{"id":42,"status":"published","facebookPostId":"..."},...]}`
- A failed post: `{"published":1,"failed":1,"results":[...{"status":"failed","error":"..."}]}`

**Note:** Failed posts are marked `failed` in the DB so you can see them in the dashboard. They won't be retried automatically — you can manually re-approve and re-schedule them from the admin UI.

---

## The full daily flow

Here's how the three jobs work together on a typical day:

```
7:00 AM UTC  — Generate runs. Drafts queue topped up to ~40 posts.
12:00 AM UTC — Schedule runs. Fills next 7 days of slots from the draft queue.
 6:00 AM UTC — Schedule runs. (Usually a no-op — slots already filled.)
 1:00 PM UTC — Publish runs. Nothing due yet.
 1:30 PM UTC — Publish runs. Nothing due yet.
 ...
 1:00 PM UTC (next slot) — Publish runs. Sends the 9 AM Eastern post.
 5:00 PM UTC — Publish runs. Sends the 1 PM Eastern post.
 9:00 PM UTC — Publish runs. Sends the 5 PM Eastern post.
```

Because the publish cron runs every 30 minutes, posts go out within 30 minutes of their scheduled time at worst — usually within a few minutes.

---

## Changing posting times or frequency

**To change the posting times**, edit `DAILY_SLOTS_UTC` at the top of `src/app/api/cron/schedule/route.ts`:

```ts
// Current: 9 AM, 1 PM, 5 PM Eastern
const DAILY_SLOTS_UTC: number[] = [13, 17, 21]

// Example: 4 posts/day at 8 AM, 12 PM, 4 PM, 8 PM Eastern
const DAILY_SLOTS_UTC: number[] = [12, 16, 20, 24]
```

If you add a 4th slot, also update the draft threshold in `src/app/api/cron/generate/route.ts` from `21` to `28` (7 days × 4 posts).

**To post on a different schedule entirely**, just change the Railway cron expressions. The app code doesn't care how often the crons run — it always does the right thing based on current DB state.

---

## Troubleshooting

**Posts aren't being published**
Check that `FACEBOOK_PAGE_ID` and `FACEBOOK_PAGE_ACCESS_TOKEN` are set on the app service. Look at the Railway logs for the publish cron — the actual Facebook error message will be in the `detail` field of the response.

**Draft queue keeps coming up empty**
The generate cron may be timing out before it finishes. Check Railway logs for the generate cron. If you see timeout errors, increase Max Duration in the cron service settings to 300 seconds.

**Schedule cron says "No draft or approved posts available"**
The generate cron hasn't run yet, or it errored out. Trigger it manually by hitting the endpoint directly in your browser's devtools or a REST client, then re-run the schedule cron.

**Cron runs but nothing happens (no logs at all)**
Verify that `CRON_SECRET` is set on the **app service**, not just the cron service. The curl command in the cron runs in Railway's container — it can reference env vars set on the cron service itself, but the secret it sends has to match what the app expects.
