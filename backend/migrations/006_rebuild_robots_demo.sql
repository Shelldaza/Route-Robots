BEGIN;

-- Reinicio deliberado de los robots y modelos de demostración.
-- Sin CASCADE: si otra tabla depende de ellas,
-- PostgreSQL rechazará la operación.
DROP TABLE IF EXISTS robots;
DROP TABLE IF EXISTS robot_models;

CREATE TABLE robot_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name TEXT NOT NULL
        CHECK (
            char_length(btrim(name)) BETWEEN 1 AND 80
        ),

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

CREATE TABLE robots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name TEXT NOT NULL
        CHECK (
            char_length(btrim(name)) BETWEEN 1 AND 80
        ),

    model_id UUID NOT NULL
        REFERENCES robot_models(id)
        ON DELETE RESTRICT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX robots_name_unique
    ON robots (LOWER(name));

CREATE INDEX robots_model_id_index
    ON robots (model_id);

-- Son perfiles ficticios para probar la aplicación.
-- No representan especificaciones de fabricantes reales.
INSERT INTO robot_models (
    id,
    name,
    speed_kmh,
    battery_capacity_wh,
    consumption_wh_per_km,
    max_slope_percent,
    width_meters,
    length_meters,
    lateral_margin_meters,
    data_source,
    source_notes
)
VALUES
(
    '10000000-0000-4000-8000-000000000001',
    'Demo compacto v1',
    4,
    500,
    40,
    NULL,
    0.60,
    0.80,
    0.15,
    'simulated',
    'Perfil ficticio para la demo. No representa un fabricante ni capacidades verificadas.'
),
(
    '10000000-0000-4000-8000-000000000002',
    'Demo estrecho v1',
    4,
    350,
    30,
    NULL,
    0.45,
    0.70,
    0.15,
    'simulated',
    'Perfil ficticio para comparar pasos estrechos. No representa capacidades verificadas.'
),
(
    '10000000-0000-4000-8000-000000000003',
    'Demo ancho v1',
    4,
    700,
    55,
    NULL,
    0.85,
    1.10,
    0.15,
    'simulated',
    'Perfil ficticio para comparar restricciones de ancho. No representa capacidades verificadas.'
);

INSERT INTO robots (
    id,
    name,
    model_id
)
VALUES
(
    '20000000-0000-4000-8000-000000000001',
    'RR-DEMO-01',
    '10000000-0000-4000-8000-000000000001'
),
(
    '20000000-0000-4000-8000-000000000002',
    'RR-DEMO-02',
    '10000000-0000-4000-8000-000000000002'
),
(
    '20000000-0000-4000-8000-000000000003',
    'RR-DEMO-03',
    '10000000-0000-4000-8000-000000000003'
);

COMMIT;