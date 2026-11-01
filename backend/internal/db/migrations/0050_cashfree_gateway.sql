-- Migration 0050: Cashfree payment gateway
--
-- Adds a config row for the Cashfree gateway to every store. It starts
-- disabled — a superadmin enters the App ID / Secret Key under
-- Backoffice → Developer and then enables it.

INSERT INTO payment_gateway_configs (tenant_id, gateway_code, display_name, is_enabled, is_test_mode, sort_order)
SELECT id, 'cashfree', 'Cashfree', FALSE, TRUE, 35
FROM tenants
WHERE NOT EXISTS (SELECT 1 FROM payment_gateway_configs WHERE tenant_id = tenants.id AND gateway_code = 'cashfree');
