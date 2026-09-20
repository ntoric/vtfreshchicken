-- 0014_permissions_management.sql
-- Granular permissions and role-based permission management (tenant-scoped)

-- ===== Permissions catalog (global, shared across all tenants) =====
CREATE TABLE IF NOT EXISTS permissions (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code        TEXT NOT NULL UNIQUE,            -- e.g. 'products.create'
    module      TEXT NOT NULL,                   -- e.g. 'products', 'orders', 'users'
    action      TEXT NOT NULL,                   -- e.g. 'create', 'read', 'update', 'delete', 'manage'
    description TEXT NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_permissions_module ON permissions(module);
CREATE INDEX IF NOT EXISTS idx_permissions_code ON permissions(code);

-- ===== Role-permission mapping (tenant-scoped, overrides defaults) =====
CREATE TABLE IF NOT EXISTS role_permissions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    role            user_role NOT NULL,           -- 'business_admin', 'staff', 'customer'
    permission_id   UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    granted         BOOLEAN NOT NULL DEFAULT TRUE, -- true=allow, false=deny (for explicit overrides)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, role, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_role_perms_tenant_role ON role_permissions(tenant_id, role);

-- ===== Seed the permissions catalog =====
INSERT INTO permissions (code, module, action, description) VALUES
-- Dashboard
('dashboard.view',        'dashboard',  'view',   'View dashboard and stats'),
-- Products
('products.view',         'products',   'view',   'View products list and details'),
('products.create',       'products',   'create', 'Create new products'),
('products.update',       'products',   'update', 'Update existing products'),
('products.delete',       'products',   'delete', 'Delete products'),
-- Categories
('categories.manage',     'categories', 'manage', 'Create, update, delete categories'),
-- Attributes
('attributes.manage',     'attributes', 'manage', 'Create, update, delete attributes'),
-- Inventory
('inventory.view',        'inventory',  'view',   'View inventory levels'),
('inventory.adjust',      'inventory',  'adjust', 'Adjust stock levels'),
-- Vendors
('vendors.view',          'vendors',    'view',   'View vendors list and details'),
('vendors.manage',        'vendors',    'manage', 'Create, update, delete vendors'),
-- Offers
('offers.view',           'offers',     'view',   'View offers'),
('offers.manage',         'offers',     'manage', 'Create, update, delete offers'),
-- Discounts
('discounts.view',        'discounts',  'view',   'View discount codes'),
('discounts.manage',      'discounts',  'manage', 'Create, update, delete discount codes'),
-- Orders
('orders.view',           'orders',     'view',   'View orders list and details'),
('orders.update',         'orders',     'update', 'Update order status and notes'),
-- Customers
('customers.view',        'customers',  'view',   'View customers list and details'),
('customers.manage',      'customers',  'manage', 'Update and delete customers'),
-- Users & Staff
('users.view',            'users',      'view',   'View users list'),
('users.manage',          'users',      'manage', 'Create, update, delete users and reset passwords'),
-- Tax
('tax.view',              'tax',        'view',   'View tax classes, zones, rates'),
('tax.manage',            'tax',        'manage', 'Create, update, delete tax configuration'),
-- Shipping
('shipping.view',         'shipping',   'view',   'View shipping methods, zones, rates'),
('shipping.manage',       'shipping',   'manage', 'Create, update, delete shipping configuration'),
-- Payments
('payments.view',         'payments',   'view',   'View payment transactions and gateways'),
('payments.manage',       'payments',   'manage', 'Refund transactions and configure gateways'),
-- Settings
('settings.view',         'settings',   'view',   'View tenant settings'),
('settings.manage',       'settings',   'manage', 'Update tenant settings'),
-- Permissions management
('permissions.manage',    'permissions','manage', 'Manage role permissions')
ON CONFLICT (code) DO NOTHING;
