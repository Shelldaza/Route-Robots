BEGIN;

CREATE TABLE surface_scenarios (
    simulation_id UUID PRIMARY KEY,
    robot_id UUID NOT NULL REFERENCES robots(id) ON DELETE RESTRICT,
    network_version TEXT NOT NULL,
    width_meters DOUBLE PRECISION,
    lateral_margin_meters DOUBLE PRECISION,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE incident_surfaces (
    incident_id UUID PRIMARY KEY REFERENCES incidents(id) ON DELETE CASCADE,
    impact JSONB NOT NULL CHECK (jsonb_typeof(impact) = 'object')
);

COMMIT;