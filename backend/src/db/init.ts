import pool from './pool';

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
  active BOOLEAN NOT NULL DEFAULT true
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
`;

const SEED_SQL = `
INSERT INTO categories (id, name, display_order) VALUES
  (1, 'drink', 0),
  (2, 'consigne', 1),
  (3, 'food', 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO products (id, name, icon, normal_price, hh_price, hh_bonus, category_id, display_order, active) VALUES
  ('biere25',        'Bière 25cl',  '🍺', 2,  2,  true,  1, 0, true),
  ('biere50',        'Bière 50cl',  '🍺', 4,  2,  true,  1, 1, true),
  ('pichet',         'Pichet 1,5L', '🍻', 10, 10, true,  1, 2, true),
  ('shooter',        'Shooter',     '🥃', 1,  1,  false, 1, 3, true),
  ('vinRouge',       'Vin Rouge',   '🍷', 2,  2,  false, 1, 4, true),
  ('vinBlanc',       'Vin Blanc',   '🥂', 2,  2,  false, 1, 5, true),
  ('consigne25',     'Csg. 25cl',   '🫙', 1,  1,  false, 2, 0, true),
  ('consigne50',     'Csg. 50cl',   '🫙', 2,  2,  false, 2, 1, true),
  ('consignePichet', 'Csg. Pichet', '🪣', 5,  5,  false, 2, 2, true),
  ('kebab',          'Kebab',       '🥙', 5,  5,  false, 3, 0, true),
  ('vege',           'Végé',        '🥗', 5,  5,  false, 3, 1, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  normal_price = EXCLUDED.normal_price,
  hh_price = EXCLUDED.hh_price,
  hh_bonus = EXCLUDED.hh_bonus,
  category_id = EXCLUDED.category_id,
  display_order = EXCLUDED.display_order,
  active = EXCLUDED.active;
`;

export async function initDatabase(): Promise<void> {
  console.log('[DB] Initializing schema...');
  await pool.query(SCHEMA_SQL);
  console.log('[DB] Schema ready.');

  console.log('[DB] Running migrations...');
  await pool.query(MIGRATION_SQL);
  console.log('[DB] Migrations complete.');

  console.log('[DB] Seeding data...');
  await pool.query(SEED_SQL);
  console.log('[DB] Seed complete.');
}
