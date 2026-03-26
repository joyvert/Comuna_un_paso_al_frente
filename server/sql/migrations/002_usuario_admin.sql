-- Ejecutar una vez en bases ya creadas: psql -f server/sql/migrations/002_usuario_admin.sql
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;
