CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS consejos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(120) NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(180) NOT NULL UNIQUE,
  nombre VARCHAR(120) NOT NULL,
  apellido VARCHAR(120) NOT NULL,
  vocero VARCHAR(120) NOT NULL,
  calle VARCHAR(120) NOT NULL,
  telefono VARCHAR(40),
  is_admin BOOLEAN NOT NULL DEFAULT false,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  pregunta1 TEXT NOT NULL,
  pregunta2 TEXT NOT NULL,
  respuesta1_hash TEXT NOT NULL,
  respuesta2_hash TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS habitantes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consejo_id UUID REFERENCES consejos(id),
  nombre VARCHAR(120) NOT NULL,
  apellido VARCHAR(120) NOT NULL,
  cedula VARCHAR(30) NOT NULL,
  telefono VARCHAR(40),
  edad INTEGER NOT NULL CHECK (edad >= 0),
  calle VARCHAR(120) NOT NULL,
  nacimiento DATE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_habitantes_cedula_consejo
ON habitantes (cedula, consejo_id);

CREATE TABLE IF NOT EXISTS pagos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consejo_id UUID REFERENCES consejos(id),
  habitante_id UUID REFERENCES habitantes(id),
  servicio VARCHAR(30) NOT NULL CHECK (servicio IN ('Gas', 'Proteínas')),
  detalle TEXT NOT NULL,
  monto NUMERIC(12,2) NOT NULL CHECK (monto >= 0),
  fecha TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO consejos (nombre) VALUES
  ('La Esperanza'),
  ('Pablo Bolívar'),
  ('Carlos Bello'),
  ('Corazón de mi Patria'),
  ('José Gregorio Hernández')
ON CONFLICT (nombre) DO NOTHING;

CREATE TABLE IF NOT EXISTS jornadas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consejo_id UUID REFERENCES consejos(id) ON DELETE CASCADE,
  servicio VARCHAR(30) NOT NULL CHECK (servicio IN ('Gas', 'Proteínas')),
  fecha_entrega DATE NOT NULL,
  estado VARCHAR(20) DEFAULT 'Cerrada',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE pagos ADD COLUMN IF NOT EXISTS jornada_id UUID REFERENCES jornadas(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS votos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  habitante_id UUID REFERENCES habitantes(id) ON DELETE CASCADE UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
