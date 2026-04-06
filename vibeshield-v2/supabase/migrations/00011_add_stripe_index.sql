CREATE INDEX idx_orgs_stripe_sub ON orgs(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;
