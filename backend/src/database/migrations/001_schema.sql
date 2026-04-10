-- ═══════════════════════════════════════════════════════════════
-- Thep Academy — PostgreSQL Schema
-- Version: 1.0.0
-- ═══════════════════════════════════════════════════════════════

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── USERS ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(255)  NOT NULL,
  email         VARCHAR(255)  UNIQUE NOT NULL,
  password_hash VARCHAR(255),                          -- NULL for OAuth users
  login_method  VARCHAR(20)   NOT NULL DEFAULT 'email', -- email | google | facebook
  google_id     VARCHAR(255)  UNIQUE,
  facebook_id   VARCHAR(255)  UNIQUE,
  avatar_url    TEXT,
  country       VARCHAR(100),
  language      VARCHAR(10)   DEFAULT 'th',
  role          VARCHAR(20)   NOT NULL DEFAULT 'student', -- student | admin
  status        VARCHAR(20)   NOT NULL DEFAULT 'active',  -- active | inactive | banned
  signup_date   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email        ON users(email);
CREATE INDEX idx_users_google_id    ON users(google_id);
CREATE INDEX idx_users_facebook_id  ON users(facebook_id);
CREATE INDEX idx_users_status       ON users(status);
CREATE INDEX idx_users_signup_date  ON users(signup_date);

-- ─── REFRESH TOKENS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       TEXT        NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token   ON refresh_tokens(token);

-- ─── COURSES ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS courses (
  id                    UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  title                 VARCHAR(500)   NOT NULL,
  description           TEXT,
  short_description     VARCHAR(500),
  category              VARCHAR(100),
  price                 DECIMAL(10,2)  NOT NULL DEFAULT 0,
  original_price        DECIMAL(10,2),
  thumbnail_url         TEXT,
  trailer_url           TEXT,
  level                 VARCHAR(20)    DEFAULT 'beginner', -- beginner | intermediate | advanced
  language              VARCHAR(10)    DEFAULT 'th',
  status                VARCHAR(20)    NOT NULL DEFAULT 'draft', -- draft | published | archived
  total_lessons         INT            NOT NULL DEFAULT 0,
  total_duration_secs   INT            NOT NULL DEFAULT 0,
  enrolled_count        INT            NOT NULL DEFAULT 0,
  rating_avg            DECIMAL(3,2)   DEFAULT 0,
  rating_count          INT            NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_courses_category   ON courses(category);
CREATE INDEX idx_courses_status     ON courses(status);
CREATE INDEX idx_courses_created_at ON courses(created_at DESC);

-- ─── LESSONS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lessons (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id        UUID         NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title            VARCHAR(500) NOT NULL,
  description      TEXT,
  video_url        TEXT,
  duration_secs    INT          NOT NULL DEFAULT 0,
  sort_order       INT          NOT NULL DEFAULT 0,
  is_free          BOOLEAN      NOT NULL DEFAULT FALSE,
  lesson_type      VARCHAR(20)  DEFAULT 'video',   -- video | text | quiz
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lessons_course_id  ON lessons(course_id);
CREATE INDEX idx_lessons_sort_order ON lessons(course_id, sort_order);

-- ─── ENROLLMENTS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS enrollments (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id             UUID          NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  enrolled_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  completion_percentage DECIMAL(5,2)  NOT NULL DEFAULT 0,
  completed_at          TIMESTAMPTZ,
  last_accessed_at      TIMESTAMPTZ,
  UNIQUE(user_id, course_id)
);

CREATE INDEX idx_enrollments_user_id   ON enrollments(user_id);
CREATE INDEX idx_enrollments_course_id ON enrollments(course_id);
CREATE INDEX idx_enrollments_enrolled_at ON enrollments(enrolled_at DESC);

-- ─── LESSON PROGRESS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lesson_progress (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id            UUID        NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  course_id            UUID        NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  status               VARCHAR(20) NOT NULL DEFAULT 'not_started', -- not_started | in_progress | completed
  time_spent_secs      INT         NOT NULL DEFAULT 0,
  last_position_secs   INT         NOT NULL DEFAULT 0,  -- resume video from here
  completed_at         TIMESTAMPTZ,
  last_watched_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, lesson_id)
);

CREATE INDEX idx_lesson_progress_user_id   ON lesson_progress(user_id);
CREATE INDEX idx_lesson_progress_course_id ON lesson_progress(course_id);
CREATE INDEX idx_lesson_progress_status    ON lesson_progress(status);

-- ─── QUIZ SCORES ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quiz_scores (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id   UUID          NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  score       DECIMAL(5,2)  NOT NULL,
  max_score   DECIMAL(5,2)  NOT NULL,
  percentage  DECIMAL(5,2)  GENERATED ALWAYS AS (ROUND((score / NULLIF(max_score, 0)) * 100, 2)) STORED,
  passed      BOOLEAN       NOT NULL DEFAULT FALSE,
  taken_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_quiz_scores_user_id   ON quiz_scores(user_id);
CREATE INDEX idx_quiz_scores_lesson_id ON quiz_scores(lesson_id);

-- ─── COUPONS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS coupons (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  code            VARCHAR(100)  UNIQUE NOT NULL,
  discount_type   VARCHAR(20)   NOT NULL, -- percentage | fixed
  discount_value  DECIMAL(10,2) NOT NULL,
  max_uses        INT,                    -- NULL = unlimited
  uses_count      INT           NOT NULL DEFAULT 0,
  min_purchase    DECIMAL(10,2) NOT NULL DEFAULT 0,
  course_id       UUID          REFERENCES courses(id), -- NULL = all courses
  expires_at      TIMESTAMPTZ,
  is_active       BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_coupons_code      ON coupons(code);
CREATE INDEX idx_coupons_is_active ON coupons(is_active);

-- ─── ORDERS ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID          NOT NULL REFERENCES users(id),
  course_id       UUID          NOT NULL REFERENCES courses(id),
  price           DECIMAL(10,2) NOT NULL,           -- final price paid
  original_price  DECIMAL(10,2) NOT NULL,           -- course price before coupon
  discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  coupon_code     VARCHAR(100),
  coupon_id       UUID          REFERENCES coupons(id),
  payment_status  VARCHAR(20)   NOT NULL DEFAULT 'pending', -- pending | completed | failed | refunded
  payment_method  VARCHAR(50),  -- stripe | omise | promptpay | free
  payment_date    TIMESTAMPTZ,
  transaction_id  VARCHAR(255),
  metadata        JSONB         NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_user_id        ON orders(user_id);
CREATE INDEX idx_orders_course_id      ON orders(course_id);
CREATE INDEX idx_orders_payment_status ON orders(payment_status);
CREATE INDEX idx_orders_payment_date   ON orders(payment_date DESC);
CREATE INDEX idx_orders_created_at     ON orders(created_at DESC);

-- ─── TRACKING EVENTS ────────────────────────────────────────────
-- Unified event store: page_view, course_view, lesson_start,
-- lesson_complete, lesson_progress, click, signup, purchase
CREATE TABLE IF NOT EXISTS tracking_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES users(id) ON DELETE SET NULL,
  session_id  VARCHAR(255) NOT NULL,
  event_type  VARCHAR(100) NOT NULL,
  page_url    TEXT,
  referrer    TEXT,
  metadata    JSONB        NOT NULL DEFAULT '{}',
  ip_address  INET,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tracking_user_id    ON tracking_events(user_id);
CREATE INDEX idx_tracking_session_id ON tracking_events(session_id);
CREATE INDEX idx_tracking_event_type ON tracking_events(event_type);
CREATE INDEX idx_tracking_created_at ON tracking_events(created_at DESC);
-- Partial index for common analytics queries
CREATE INDEX idx_tracking_page_view  ON tracking_events(created_at DESC) WHERE event_type = 'page_view';

-- ─── UTM TRACKING ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS utm_tracking (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID         REFERENCES users(id) ON DELETE SET NULL,
  session_id    VARCHAR(255) NOT NULL,
  utm_source    VARCHAR(255),
  utm_medium    VARCHAR(255),
  utm_campaign  VARCHAR(255),
  utm_term      VARCHAR(255),
  utm_content   VARCHAR(255),
  landing_page  TEXT,
  referrer      TEXT,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_utm_user_id    ON utm_tracking(user_id);
CREATE INDEX idx_utm_session_id ON utm_tracking(session_id);
CREATE INDEX idx_utm_source     ON utm_tracking(utm_source);
CREATE INDEX idx_utm_campaign   ON utm_tracking(utm_campaign);
CREATE INDEX idx_utm_created_at ON utm_tracking(created_at DESC);

-- ─── CONVERSION FUNNEL ──────────────────────────────────────────
-- Steps: visit → signup → course_view → checkout_start → purchase
CREATE TABLE IF NOT EXISTS conversion_funnel (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID         REFERENCES users(id) ON DELETE SET NULL,
  session_id  VARCHAR(255) NOT NULL,
  step        VARCHAR(50)  NOT NULL,
  course_id   UUID         REFERENCES courses(id),
  metadata    JSONB        NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_funnel_user_id    ON conversion_funnel(user_id);
CREATE INDEX idx_funnel_session_id ON conversion_funnel(session_id);
CREATE INDEX idx_funnel_step       ON conversion_funnel(step);
CREATE INDEX idx_funnel_created_at ON conversion_funnel(created_at DESC);

-- ─── AUTO-UPDATE updated_at TRIGGER ─────────────────────────────
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_users
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_courses
  BEFORE UPDATE ON courses
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_lessons
  BEFORE UPDATE ON lessons
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ─── AUTO-UPDATE course enrollment count ────────────────────────
CREATE OR REPLACE FUNCTION update_course_enrollment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE courses SET enrolled_count = enrolled_count + 1 WHERE id = NEW.course_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE courses SET enrolled_count = enrolled_count - 1 WHERE id = OLD.course_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_enrollment_count
  AFTER INSERT OR DELETE ON enrollments
  FOR EACH ROW EXECUTE FUNCTION update_course_enrollment_count();

-- ─── AUTO-UPDATE course lesson count & duration ─────────────────
CREATE OR REPLACE FUNCTION update_course_lesson_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE courses
  SET
    total_lessons       = (SELECT COUNT(*) FROM lessons WHERE course_id = COALESCE(NEW.course_id, OLD.course_id)),
    total_duration_secs = (SELECT COALESCE(SUM(duration_secs), 0) FROM lessons WHERE course_id = COALESCE(NEW.course_id, OLD.course_id))
  WHERE id = COALESCE(NEW.course_id, OLD.course_id);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_course_lesson_stats
  AFTER INSERT OR UPDATE OR DELETE ON lessons
  FOR EACH ROW EXECUTE FUNCTION update_course_lesson_stats();
