ALTER TABLE ad_scan_requests ADD COLUMN catalog_json TEXT;
CREATE INDEX ad_scan_requests_created ON ad_scan_requests (created_at DESC, id DESC);

-- Recheck the lifecycle of completed requests created before airing tracking.
UPDATE ad_scan_requests SET ongoing = 1, next_check_at = unixepoch() WHERE status = 'completed';
