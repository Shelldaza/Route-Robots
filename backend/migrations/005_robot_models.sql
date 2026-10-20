BEGIN;

CREATE TABLE robot_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name TEXT NOT NULL
        CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),

    speed_kmh DOUBLE PRECISION NOT NULL
        CHECK (
            speed_kmh > 0
            AND speed_kmh < 'Infinity'::DOUBLE PRECISION
        ),

    battery_capacity_wh DOUBLE PRECISION NOT NULL
        CHECK (
            battery_capacity_wh > 0
            AND battery_capacity_wh < 'Infinity'::DOUBLE PRECISION
        ),

    consumption_wh_per_km DOUBLE PRECISION NOT NULL
        CHECK (
            consumption_wh_per_km > 0
            AND consumption_wh_per_km < 'Infinity'::DOUBLE PRECISION
        ),

    max_slope_percent DOUBLE PRECISION
        CHECK (
            max_slope_percent >= 0
            AND max_slope_percent < 'Infinity'::DOUBLE PRECISION
        ),

    width_meters DOUBLE PRECISION
        CHECK (
            width_meters > 0
            AND width_meters < 'Infinity'::DOUBLE PRECISION
        ),

    length_meters DOUBLE PRECISION
        CHECK (
            length_meters > 0
            AND length_meters < 'Infinity'::DOUBLE PRECISION
        ),

    lateral_margin_meters DOUBLE PRECISION
        CHECK (
            lateral_margin_meters >= 0
            AND lateral_margin_meters < 'Infinity'::DOUBLE PRECISION
        ),

    data_source TEXT NOT NULL
        CHECK (
            data_source IN (
                'simulated',
                'documented',
                'measured',
                'unknown'
            )
        ),

    source_notes TEXT
        CHECK (
            char_length(btrim(source_notes)) BETWEEN 1 AND 500
        ),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (
        data_source NOT IN ('documented', 'measured')
        OR source_notes IS NOT NULL
    )
);

CREATE UNIQUE INDEX robot_models_name_unique
    ON robot_models (LOWER(name));

-- Los registros anteriores conservan sus valores
-- y no reciben medidas inventadas.
ALTER TABLE robots
    ADD COLUMN model_id UUID
    REFERENCES robot_models(id)
    ON DELETE RESTRICT;

CREATE INDEX robots_model_id_index
    ON robots (model_id);

COMMIT;