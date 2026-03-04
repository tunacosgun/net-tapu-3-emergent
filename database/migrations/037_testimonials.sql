-- 037: Testimonials table for customer reviews

CREATE TABLE IF NOT EXISTS admin.testimonials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  title VARCHAR(500),
  comment TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  photo_url VARCHAR(1000),
  video_url VARCHAR(1000),
  is_approved BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_testimonials_approved ON admin.testimonials(is_approved, sort_order);

COMMENT ON TABLE admin.testimonials IS 'Customer testimonials and reviews for the references page';
