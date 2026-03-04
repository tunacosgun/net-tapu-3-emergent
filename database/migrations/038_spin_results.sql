-- Spin wheel results tracking
CREATE TABLE IF NOT EXISTS campaigns.spin_results (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id),
  campaign_id   UUID NOT NULL REFERENCES campaigns.campaigns(id),
  prize_key     VARCHAR(100) NOT NULL,
  prize_label   VARCHAR(255) NOT NULL,
  discount_code VARCHAR(50),
  is_redeemed   BOOLEAN NOT NULL DEFAULT FALSE,
  redeemed_at   TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_spin_results_user ON campaigns.spin_results(user_id);
CREATE INDEX idx_spin_results_campaign ON campaigns.spin_results(campaign_id);
CREATE UNIQUE INDEX idx_spin_results_discount_code ON campaigns.spin_results(discount_code) WHERE discount_code IS NOT NULL;
