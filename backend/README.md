# Thep Academy — Backend API

Node.js + Express + PostgreSQL backend for the Thep Academy online learning platform.

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy environment file
cp .env.example .env
# → Edit .env with your DB credentials, JWT secrets, and OAuth keys

# 3. Create the PostgreSQL database
createdb thep_academy

# 4. Run migrations
npm run migrate

# 5. Start dev server
npm run dev
```

Server runs on: `http://localhost:4000`
Health check: `http://localhost:4000/health`

---

## Project Structure

```
src/
├── app.js                    # Express app (middleware, routes)
├── server.js                 # Entry point (DB check, listen)
├── config/
│   ├── database.js           # PostgreSQL pool
│   ├── passport.js           # JWT + Google + Facebook strategies
│   └── logger.js             # Winston logger
├── middleware/
│   ├── auth.js               # requireAuth, requireAdmin, optionalAuth
│   ├── errorHandler.js       # Global error handler + asyncHandler
│   ├── rateLimiter.js        # API + auth rate limiting
│   └── validate.js           # express-validator middleware
├── database/
│   ├── migrate.js            # Migration runner
│   └── migrations/
│       └── 001_schema.sql    # Full schema + triggers
└── modules/
    ├── auth/                 # Login, register, OAuth, tokens
    ├── users/                # Profile, password, enrollments
    ├── courses/              # CRUD courses + lessons
    ├── progress/             # Enrollments, lesson progress, quizzes
    ├── orders/               # Purchase flow, coupon validation, webhook
    ├── tracking/             # Events, UTM, conversion funnel
    └── admin/                # Dashboard analytics APIs
```

---

## API Reference

### Authentication — `/api/auth`

| Method | Endpoint                | Auth     | Description                       |
|--------|-------------------------|----------|-----------------------------------|
| POST   | `/register`             | —        | Email/password registration       |
| POST   | `/login`                | —        | Email/password login              |
| POST   | `/refresh`              | —        | Rotate access token               |
| POST   | `/logout`               | —        | Revoke refresh token              |
| POST   | `/logout-all`           | JWT      | Revoke all sessions               |
| GET    | `/me`                   | JWT      | Current user info                 |
| GET    | `/google`               | —        | Start Google OAuth                |
| GET    | `/google/callback`      | —        | Google OAuth callback             |
| GET    | `/facebook`             | —        | Start Facebook OAuth              |
| GET    | `/facebook/callback`    | —        | Facebook OAuth callback           |

### Users — `/api/users`

| Method | Endpoint             | Auth        | Description                  |
|--------|----------------------|-------------|------------------------------|
| GET    | `/me`                | JWT         | Get my profile               |
| PUT    | `/me`                | JWT         | Update my profile            |
| PUT    | `/me/password`       | JWT         | Change password              |
| GET    | `/me/enrollments`    | JWT         | My enrolled courses          |
| GET    | `/`                  | JWT + Admin | List all users               |
| GET    | `/:id`               | JWT + Admin | Get user by ID               |
| PATCH  | `/:id/status`        | JWT + Admin | Set active/inactive/banned   |

### Courses — `/api/courses`

| Method | Endpoint                        | Auth        | Description           |
|--------|---------------------------------|-------------|-----------------------|
| GET    | `/`                             | Optional    | List courses          |
| GET    | `/:id`                          | Optional    | Course detail         |
| POST   | `/`                             | JWT + Admin | Create course         |
| PUT    | `/:id`                          | JWT + Admin | Update course         |
| DELETE | `/:id`                          | JWT + Admin | Delete course         |
| GET    | `/:courseId/lessons`            | Optional    | List lessons          |
| POST   | `/:courseId/lessons`            | JWT + Admin | Add lesson            |
| PUT    | `/:courseId/lessons/:lessonId`  | JWT + Admin | Update lesson         |
| DELETE | `/:courseId/lessons/:lessonId`  | JWT + Admin | Delete lesson         |

### Progress — `/api/progress`

| Method | Endpoint                       | Auth | Description                     |
|--------|--------------------------------|------|---------------------------------|
| POST   | `/enroll/:courseId`            | JWT  | Enroll in a course              |
| GET    | `/courses/:courseId`           | JWT  | Full course progress            |
| POST   | `/lessons/:lessonId`           | JWT  | Update lesson progress          |
| POST   | `/quiz/:lessonId`              | JWT  | Submit quiz result              |
| GET    | `/quiz/:lessonId/history`      | JWT  | Quiz attempt history            |

### Orders — `/api/orders`

| Method | Endpoint                 | Auth        | Description               |
|--------|--------------------------|-------------|---------------------------|
| POST   | `/`                      | JWT         | Create order              |
| POST   | `/validate-coupon`       | JWT         | Check coupon validity     |
| POST   | `/webhook/complete`      | —           | Payment gateway webhook   |
| GET    | `/me`                    | JWT         | My purchase history       |
| GET    | `/me/:orderId`           | JWT         | Single order detail       |
| GET    | `/`                      | JWT + Admin | All orders                |
| GET    | `/:orderId`              | JWT + Admin | Admin view single order   |

### Tracking — `/api/track`

| Method | Endpoint         | Auth     | Description               |
|--------|------------------|----------|---------------------------|
| POST   | `/`              | Optional | Log any client event      |
| POST   | `/utm`           | Optional | Capture UTM parameters    |
| POST   | `/funnel`        | Optional | Record funnel step        |
| POST   | `/link-session`  | —        | Link session → user       |

### Admin Dashboard — `/api/admin` *(JWT + Admin)*

| Method | Endpoint         | Description                          |
|--------|------------------|--------------------------------------|
| GET    | `/overview`      | Total users, revenue, orders KPIs    |
| GET    | `/revenue`       | Revenue time series (`?days=30`)     |
| GET    | `/active-users`  | DAU / WAU / MAU                      |
| GET    | `/top-courses`   | Top courses by revenue or enrollment |
| GET    | `/engagement`    | Event time series                    |
| GET    | `/funnel`        | Conversion funnel breakdown          |
| GET    | `/utm`           | UTM source/campaign breakdown        |
| GET    | `/signups`       | Signup trend by login method         |

---

## Database Schema — Key Tables

| Table                | Purpose                                      |
|----------------------|----------------------------------------------|
| `users`              | Accounts (email + Google + Facebook)         |
| `refresh_tokens`     | Stored JWTs for rotation/revocation          |
| `courses`            | Course catalog                               |
| `lessons`            | Lessons per course                           |
| `enrollments`        | User ↔ Course, completion %                  |
| `lesson_progress`    | Per-lesson watch status, time spent, resume  |
| `quiz_scores`        | Quiz attempt records                         |
| `coupons`            | Discount codes (% or fixed, expiry, limits)  |
| `orders`             | Purchase records, payment status             |
| `tracking_events`    | All client events (page views, clicks, etc.) |
| `utm_tracking`       | UTM parameter captures per session           |
| `conversion_funnel`  | Visit → Signup → Purchase funnel steps       |

---

## Environment Variables

See `.env.example` for the full list. Key variables:

```
DB_HOST / DB_NAME / DB_USER / DB_PASSWORD  — PostgreSQL
JWT_SECRET                                 — Sign access tokens
JWT_REFRESH_SECRET                         — Sign refresh tokens
GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET    — Google OAuth
FACEBOOK_APP_ID / FACEBOOK_APP_SECRET      — Facebook OAuth
FRONTEND_URL                               — OAuth redirect base URL
```

---

## OAuth Setup

**Google:** Create a project at [console.cloud.google.com](https://console.cloud.google.com), enable "Google+ API", add `http://localhost:4000/api/auth/google/callback` as an authorized redirect URI.

**Facebook:** Create an app at [developers.facebook.com](https://developers.facebook.com), add `http://localhost:4000/api/auth/facebook/callback` as a valid OAuth redirect.

---

## Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Use strong random `JWT_SECRET` and `JWT_REFRESH_SECRET`
- [ ] Enable SSL on PostgreSQL (`DB_SSL=true`)
- [ ] Set `FRONTEND_URL` to your production domain
- [ ] Add webhook signature verification in `orders.routes.js`
- [ ] Set up `logs/` directory with proper permissions
- [ ] Use a process manager (PM2 / Docker)
