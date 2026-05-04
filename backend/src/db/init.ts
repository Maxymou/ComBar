import pool from './pool';
import { logger } from '../logger';

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  display_order INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  icon VARCHAR(10) NOT NULL DEFAULT '',
  normal_price NUMERIC(10,2) NOT NULL,
  hh_price NUMERIC(10,2) NOT NULL,
  hh_bonus BOOLEAN NOT NULL DEFAULT false,
  category_id INT REFERENCES categories(id),
  display_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  bonus_parent_product_id VARCHAR(50) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  client_order_id VARCHAR(100) UNIQUE,
  client_id VARCHAR(100),
  total NUMERIC(10,2) NOT NULL,
  is_happy_hour BOOLEAN NOT NULL DEFAULT false,
  payment_given NUMERIC(10,2),
  payment_change NUMERIC(10,2),
  status VARCHAR(20) NOT NULL DEFAULT 'completed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  synced_from_offline BOOLEAN NOT NULL DEFAULT false,
  client_priced BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS order_lines (
  id SERIAL PRIMARY KEY,
  order_id INT REFERENCES orders(id) ON DELETE CASCADE,
  product_id VARCHAR(50),
  product_name VARCHAR(100) NOT NULL,
  quantity INT NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  subtotal NUMERIC(10,2) NOT NULL,
  is_bonus BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS app_settings (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

const MIGRATION_SQL = `
ALTER TABLE orders ADD COLUMN IF NOT EXISTS client_order_id VARCHAR(100);
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_client_order_id_key'
  ) THEN
    ALTER TABLE orders ADD CONSTRAINT orders_client_order_id_key UNIQUE (client_order_id);
  END IF;
END $$;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS client_priced BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS bonus_parent_product_id VARCHAR(50) REFERENCES products(id);
ALTER TABLE products ADD COLUMN IF NOT EXISTS icon_type VARCHAR(20) NOT NULL DEFAULT 'emoji';
ALTER TABLE products ADD COLUMN IF NOT EXISTS icon_url TEXT;
`;

const SEED_SQL = `
-- Seed data must be non-destructive: only create missing defaults and never overwrite
-- user customizations made from the management interface.
INSERT INTO categories (id, name, display_order) VALUES
  (1, 'drink', 0),
  (2, 'consigne', 1),
  (3, 'food', 2),
  (4, 'soft', 3),
  (5, 'sandwich', 4)
ON CONFLICT (id) DO NOTHING;

INSERT INTO products (id, name, icon, icon_type, icon_url, normal_price, hh_price, hh_bonus, category_id, display_order, active, bonus_parent_product_id) VALUES
  ('biere25',        'Bière 25cl',   '🍺', 'emoji', null, 2,  2,  true,  1, 0, true, 'biere50'),
  ('biere50',        'Bière 50cl',   '🍺', 'emoji', null, 4,  2,  true,  1, 1, true, null),
  ('pichet',         'Pichet 1,5L',  '🍻', 'emoji', null, 10, 10, true,  1, 2, true, null),
  ('shooter',        'Shooter',      '🥃', 'emoji', null, 1,  1,  false, 1, 3, true, null),
  ('vinRouge',       'Vin Rouge',    '🍷', 'emoji', null, 2,  2,  false, 1, 4, true, null),
  ('vinBlanc',       'Vin Blanc',    '🥂', 'emoji', null, 2,  2,  false, 1, 5, true, null),
  ('consigne25',     'Csg. 25cl',    '🫙', 'emoji', null, 1,  1,  false, 2, 0, true, null),
  ('consigne50',     'Csg. 50cl',    '🫙', 'emoji', null, 2,  2,  false, 2, 1, true, null),
  ('consignePichet', 'Csg. Pichet',  '🪣', 'emoji', null, 5,  5,  false, 2, 2, true, null),
  ('kebab',          'Kebab',        '🥙', 'emoji', null, 5,  5,  false, 3, 0, true, null),
  ('vege',           'Végé',         '🥗', 'emoji', null, 5,  5,  false, 3, 1, true, null),
  ('coca',           'Coca',         '🥤', 'emoji', null, 2,  2,  false, 4, 0, true, null),
  ('jambonBeurre',   'Jambon beurre','🥪', 'emoji', null, 5,  5,  false, 5, 0, true, null)
ON CONFLICT (id) DO NOTHING;


INSERT INTO app_settings (key, value) VALUES
  ('realtime_state', '{"prices":{},"happyHour":false}'::jsonb)
ON CONFLICT (key) DO NOTHING;
`;

export async function initDatabase(): Promise<void> {
  logger.info('Initializing database schema');
  await pool.query(SCHEMA_SQL);

  logger.info('Running database migrations');
  await pool.query(MIGRATION_SQL);

  logger.info('Seeding initial data');
  await pool.query(SEED_SQL);
  logger.info('Database ready');
}
