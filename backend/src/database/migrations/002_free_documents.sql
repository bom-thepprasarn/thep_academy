-- ═══════════════════════════════════════════════════════════════
-- Thep Academy — Migration 002: Free Documents
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS free_documents (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  title           VARCHAR(500)  NOT NULL,
  description     TEXT,
  category        VARCHAR(100),            -- Grammar | Vocabulary | Writing | Reading | IELTS | Entrance
  file_url        TEXT          NOT NULL,   -- direct download link (S3, Drive, etc.)
  thumbnail_url   TEXT,
  pages           INT           DEFAULT 0,
  file_size_kb    INT           DEFAULT 0,
  file_type       VARCHAR(10)   DEFAULT 'pdf',
  requires_login  BOOLEAN       NOT NULL DEFAULT TRUE,  -- false = public download
  download_count  INT           NOT NULL DEFAULT 0,
  is_active       BOOLEAN       NOT NULL DEFAULT TRUE,
  sort_order      INT           NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_free_documents_category  ON free_documents(category);
CREATE INDEX idx_free_documents_is_active ON free_documents(is_active);
CREATE INDEX idx_free_documents_sort      ON free_documents(sort_order);

-- Track downloads per user (prevent abuse & analytics)
CREATE TABLE IF NOT EXISTS document_downloads (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  UUID        NOT NULL REFERENCES free_documents(id) ON DELETE CASCADE,
  user_id      UUID        REFERENCES users(id) ON DELETE SET NULL,
  session_id   VARCHAR(255),
  ip_address   INET,
  downloaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_doc_downloads_document_id  ON document_downloads(document_id);
CREATE INDEX idx_doc_downloads_user_id      ON document_downloads(user_id);
CREATE INDEX idx_doc_downloads_downloaded_at ON document_downloads(downloaded_at DESC);

-- Auto-update updated_at
CREATE TRIGGER set_updated_at_free_documents
  BEFORE UPDATE ON free_documents
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
