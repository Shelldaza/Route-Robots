BEGIN;

ALTER TABLE incidents
    DROP CONSTRAINT incidents_type_check,
    DROP CONSTRAINT incidents_source_check;

-- El vencimiento se comparará con el inicio del evento,
-- que puede pertenecer al reloj simulado.
DO $$
DECLARE
    constraint_record RECORD;
BEGIN
    FOR constraint_record IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'incidents'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) LIKE '%expires_at%'
          AND pg_get_constraintdef(oid) LIKE '%created_at%'
    LOOP
        EXECUTE format(
            'ALTER TABLE incidents DROP CONSTRAINT %I',
            constraint_record.conname
        );
    END LOOP;
END;
$$;

ALTER TABLE incidents
    ADD COLUMN description TEXT,
    ADD COLUMN effect TEXT NOT NULL DEFAULT 'blockage',
    ADD COLUMN reporter_name TEXT,
    ADD COLUMN starts_at TIMESTAMPTZ;

-- Conservamos los incidentes anteriores.
UPDATE incidents
SET
    description = 'Bloqueo registrado en la simulación.',
    reporter_name = 'Simulador',
    starts_at = created_at;

ALTER TABLE incidents
    ALTER COLUMN description SET NOT NULL,
    ALTER COLUMN starts_at SET NOT NULL,
    ALTER COLUMN starts_at SET DEFAULT NOW();

ALTER TABLE incidents
    ADD CONSTRAINT incidents_type_check
        CHECK (
            type IN (
                'blockage',
                'temporary_obstacle',
                'temporary_closure',
                'roadworks',
                'standing_water',
                'crowd',
                'obstructing_vehicle',
                'scheduled_event',
                'pothole',
                'uneven_surface'
            )
        ),

    ADD CONSTRAINT incidents_source_check
        CHECK (
            source IN (
                'simulation',
                'manual',
                'ai_generated'
            )
        ),

    ADD CONSTRAINT incidents_effect_check
        CHECK (
            effect IN (
                'informational',
                'caution',
                'blockage'
            )
        ),

    ADD CONSTRAINT incidents_description_check
        CHECK (
            char_length(btrim(description))
                BETWEEN 1 AND 500
        ),

    ADD CONSTRAINT incidents_reporter_name_check
        CHECK (
            reporter_name IS NULL
            OR char_length(btrim(reporter_name))
                BETWEEN 1 AND 80
        ),

    ADD CONSTRAINT incidents_lifetime_check
        CHECK (expires_at > starts_at);

CREATE INDEX incidents_simulation_activity_idx
    ON incidents (simulation_id, starts_at, expires_at);

COMMIT;