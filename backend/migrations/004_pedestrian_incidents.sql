BEGIN;
ALTER TABLE incidents ADD COLUMN pedestrian_impact JSONB;
ALTER TABLE incidents ADD CONSTRAINT incidents_pedestrian_impact_check
    CHECK (pedestrian_impact IS NULL OR (
        jsonb_typeof(pedestrian_impact) = 'object'
        AND pedestrian_impact ?& ARRAY['networkVersion', 'scope', 'segmentIds', 'segments']
        AND pedestrian_impact->>'scope' IN ('segment', 'street_section')
        AND jsonb_typeof(pedestrian_impact->'segments') = 'array'
        AND jsonb_array_length(pedestrian_impact->'segments') > 0
    ));
COMMIT;
