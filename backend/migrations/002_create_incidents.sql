CREATE TABLE incidents (
    id UUID PRIMARY KEY,
    simulation_id UUID NOT NULL,

    type TEXT NOT NULL DEFAULT 'blockage'
        CHECK (type = 'blockage'),

    source TEXT NOT NULL DEFAULT 'simulation'
        CHECK (source = 'simulation'),

    south DOUBLE PRECISION NOT NULL
        CHECK (south BETWEEN -90 AND 90),

    west DOUBLE PRECISION NOT NULL
        CHECK (west BETWEEN -180 AND 180),

    north DOUBLE PRECISION NOT NULL
        CHECK (north BETWEEN -90 AND 90),

    east DOUBLE PRECISION NOT NULL
        CHECK (east BETWEEN -180 AND 180),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '15 minutes',

    CHECK (south < north),
    CHECK (west < east),
    CHECK (expires_at > created_at)
);

CREATE INDEX incidents_simulation_expiration_idx
    ON incidents (simulation_id, expires_at);