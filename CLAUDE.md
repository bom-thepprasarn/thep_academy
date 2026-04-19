# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Overview

**Thep Academy** — Thai online English learning platform at **https://thep-academy.com**  
Deployed via **GitHub Pages** (CNAME file points to `thep-academy.com`).  
Owner: BB (teera.thepprasarn@gmail.com) — also known as พี่บอม.

Target audience: Thai learners preparing for TOEIC, TGAT, A-Level, and general English exams.

---

## Architecture: Two Separate Worlds

### 1. Frontend (LIVE — on GitHub Pages)
Pure HTML + CSS + JS. **No framework, no build step.**  
Files in `thep_academy-main/` root are deployed directly.

| File | Purpose |
|---|---|
| `index.html` | Homepage (main landing page) |
| `pretest.html` | Free pre-test exam with 208-question bank |
| `mock-exam.html` | Full mock exam simulator |
| `courses.html` | Course catalog |
| `grammar_foundation.html` | Grammar Foundation course page |
| `join.html` | Sign-up / join page |
| `12_tenses_table.html` | Tenses reference table |
| `onet_m3_vocab_500.html` | ONET M3 vocab course |
| `blog_*.html` | Blog articles |
| `kham.html` | (Unrelated — do not touch) |

Assets live in `assets/`:
- `assets/data/questions.json` — 208-question bank (Grammar 108 + Vocabulary 60 + Reading 40)
- `assets/data/onet_m3_vocab_500.json` — ONET vocabulary data
- `assets/js/exam-engine.js` — Core exam logic module
- `assets/js/exam-timer.js` — Timer module (must load before exam-engine.js)
- `assets/js/session-recovery.js` — localStorage checkpoint (must load before exam-engine.js)
- `assets/images/` — Photos, banners, logo

### 2. Backend (NOT yet connected to live site)
Node.js/Express API in `backend/`. Database is PostgreSQL. **Not deployed yet.**

---

## Design System (CRITICAL — apply consistently)

### Colors
```css
--navy:    #0f1f3d   /* primary background */
--navy2:   #1e3a5f   /* secondary background */
--orange:  #F97316   /* primary accent, CTAs */
--orange2: #fb923c   /* hover state */
--green:   #16a34a   /* correct answers, success */
--red:     #dc2626   /* wrong answers, error */
--white:   #ffffff
--off:     #f8fafc   /* light background */
--gray:    #e2e8f0
--mid:     #64748b
--dark:    #1e293b
```

### Fonts
- **Sarabun** — body text, Thai + English (Google Fonts)
- **IBM Plex Mono** — code, monospace elements

### Icon Rules (STRICTLY ENFORCED)
All general UI icons MUST be minimal stroke SVG only:
```html
<svg fill="none" stroke="var(--orange)" stroke-width="1.5" 
     stroke-linecap="round" stroke-linejoin="round" ...>
```
- **Never** use emoji as icons
- **Never** use filled icons for UI elements
- **Exception**: Planet icons (Moon, Mars, Pluto) in the Research section use realistic gradient SVG — they are illustrative, not UI icons

---

## Frontend: Exam Engine

The exam system has two modes, switchable without breaking changes:

### Local Mode (currently active on live site)
Questions loaded from `assets/data/questions.json` client-side.  
Answers are visible in the client (acceptable for free pretest).

### API Mode (future — connects to backend)
```js
ExamEngine.configure({ mode: 'api', apiBase: '/api/exam' });
```
Answer keys never sent to client — server scores them.

### Question Bank Schema
```json
{
  "id": 1,
  "category": "Grammar",   // "Grammar" | "Vocabulary" | "Reading"
  "question": "...",
  "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
  "answer": "A",            // correct letter
  "explanation": "..."      // optional
}
```

### ExamEngine Public API
```js
ExamEngine.configure(opts)    // set mode, examType, questionCount, perCategory
ExamEngine.init()             // load questions, emit 'exam:ready'
ExamEngine.startSession()     // begin exam, checks localStorage for resume
ExamEngine.goTo(index)        // navigate to question
ExamEngine.selectAnswer('A')  // record answer, checkpoint every N answers
ExamEngine.submit()           // score and emit 'exam:results'
ExamEngine.getState()         // snapshot for UI
```

DOM events fired:
- `exam:ready` — questions loaded
- `exam:question` — navigate (detail: `{ q, cur, total, answered, secsLeft }`)
- `exam:answered` — answer recorded
- `exam:results` — exam submitted
- `exam:error` — failure

### SessionRecovery
Saves exam state to `localStorage` key `thep_exam_checkpoint` every N answers (default 5) and every 60 seconds via timer. TTL is 2 hours. On `startSession()`, it prompts the user to resume if a valid checkpoint exists.

---

## Backend Architecture

### Commands
```bash
cd backend
npm run dev        # nodemon (development)
npm start          # production
npm run migrate    # run SQL migrations in order
npm run seed       # seed sample data
```

### Required .env variables
```
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://user:pass@localhost:5432/thep_academy
JWT_SECRET=...
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=...
JWT_REFRESH_EXPIRES_IN=30d
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=...
FACEBOOK_APP_ID=...
FACEBOOK_APP_SECRET=...
FACEBOOK_CALLBACK_URL=...
FRONTEND_URL=https://thep-academy.com
QUESTIONS_PATH=./questions.json   # path to question bank for exam service
```

### Module Structure
Each feature lives in `src/modules/<name>/` with `.routes.js` and `.service.js` files.

| Route prefix | Module | Key responsibility |
|---|---|---|
| `/api/auth` | auth | Register, login, OAuth, JWT refresh, logout |
| `/api/users` | users | Profile management |
| `/api/courses` | courses | Course catalog CRUD |
| `/api/progress` | progress | Lesson progress tracking |
| `/api/orders` | orders | Purchase flow with coupon support |
| `/api/track` | tracking | Analytics events, UTM params, conversion funnel |
| `/api/admin` | admin | Admin dashboard stats |
| `/api/documents` | documents | Free document downloads |
| `/api/exam` | exam | Server-side exam sessions |

### Authentication Flow
1. **Email/password**: `POST /api/auth/register` or `POST /api/auth/login` → returns `accessToken` (7d) + `refreshToken` (30d)
2. **Google OAuth**: redirect to `/api/auth/google` → callback → same tokens
3. **Facebook OAuth**: redirect to `/api/auth/facebook` → callback → same tokens
4. **Token refresh**: `POST /api/auth/refresh` with `refreshToken` in body → rotates both tokens
5. **Logout**: `POST /api/auth/logout` → deletes refresh token from DB
6. JWT is extracted from `Authorization: Bearer <token>` header

Passport strategies: `local`, `jwt`, `google-oauth20`, `facebook`

### Database Schema (PostgreSQL)
Migrations: `src/database/migrations/001_schema.sql`, `002_free_documents.sql`

**Core tables:**

| Table | Key columns |
|---|---|
| `users` | id (UUID), name, email, password_hash, login_method, google_id, facebook_id, role (student\|admin), status (active\|inactive\|banned) |
| `refresh_tokens` | id, user_id, token, expires_at |
| `courses` | id, title, category, price, original_price, level, status (draft\|published\|archived), total_lessons, enrolled_count, rating_avg |
| `lessons` | id, course_id, title, video_url, duration_secs, sort_order, is_free, lesson_type (video\|text\|quiz) |
| `enrollments` | user_id + course_id (unique), completion_percentage, completed_at |
| `lesson_progress` | user_id + lesson_id (unique), status (not_started\|in_progress\|completed), last_position_secs |
| `quiz_scores` | user_id, lesson_id, score, max_score, percentage (computed), passed |
| `coupons` | code, discount_type (percentage\|fixed), discount_value, max_uses, expires_at, course_id |
| `orders` | user_id, course_id, price, original_price, discount_amount, payment_status (pending\|completed\|failed\|refunded), payment_method |
| `tracking_events` | user_id, session_id, event_type, page_url, metadata (JSONB) |
| `utm_tracking` | session_id, utm_source/medium/campaign/term/content, landing_page |
| `conversion_funnel` | session_id, step (visit→signup→course_view→checkout_start→purchase) |
| `free_documents` | title, category, file_url, requires_login, download_count |

**Auto-triggers (in DB, no code needed):**
- `updated_at` auto-set on UPDATE for users, courses, lessons, free_documents
- `courses.enrolled_count` auto-incremented/decremented on enrollment INSERT/DELETE
- `courses.total_lessons` and `total_duration_secs` auto-updated on lesson INSERT/UPDATE/DELETE

### Server-Side Exam Sessions (`exam.service.js`)
- Sessions stored in **in-memory Map** (lost on restart — acceptable for stateless simulator)
- TTL: 2 hours, swept every 30 minutes
- `startSession()` returns questions **without** the `answer` field
- `submitExam()` scores server-side, returns full results with `catStats`, `review`, `wrongQuestionIds`
- `retakeWrong()` creates a new session from previously wrong question IDs
- Question bank loaded from `QUESTIONS_PATH` env var or `backend/questions.json` (lazy-cached)

---

## Deployment

- **Live site**: GitHub → GitHub Pages → `thep-academy.com` (via CNAME)
- **Push to deploy**: `git push origin main` from `thep_academy-main/`
- **No build step** — HTML files are served as-is
- Analytics: Google Analytics `G-X05ZGMBFW7` (gtag.js in every page `<head>`)

### Committing (macOS Terminal)
```bash
cd /path/to/thep_academy-main
git add -p          # stage selectively
git commit -m "..."
git push origin main
```

---

## Content Structure

### Navigation Bar Sections
- หน้าแรก (Home → index.html)
- หลักสูตร (Courses — dropdown with course links)
- วิจัย (Research — dropdown: วิจัยด้านภาษาอังกฤษ / วิจัยด้านบริหารธุรกิจ — both "coming soon")
- บทความ (Blog — links to blog_*.html files)
- ทดสอบตัวเอง (Pre-test → pretest.html)

### Research Section (index.html)
Filtered by tab: ธุรกิจ / ภาษาอังกฤษ. Uses planet icons (Moon = English, Mars = Business, Pluto = extra). Kept visually understated — research is secondary to courses.

### Course Pages
- `grammar_foundation.html` — Grammar Foundation course
- `onet_m3_vocab_500.html` — ONET M3 Vocabulary
- Additional courses to be added

---

## Working Notes

- The `รอสะสาง/` folder in `Thep_Academy/` contains archived/deprecated files — do not touch
- `kham.html` is unrelated to the platform — do not modify or reference
- Video hosting: YouTube (embed) preferred; Vimeo blob URLs are not embeddable
- The backend is fully built but **not yet deployed** — the live site still uses local JS for all interactivity
- When the backend is connected, `ExamEngine.configure({ mode: 'api' })` switches the exam to server-side scoring with zero frontend rewrites
