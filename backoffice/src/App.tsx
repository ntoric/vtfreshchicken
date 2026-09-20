import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Layout } from "@/components/Layout";
import { RouteErrorBoundary } from "@/components/ErrorBoundary";
import { Login } from "@/pages/Login";
import { Setup } from "@/pages/Setup";
import { Dashboard } from "@/pages/Dashboard";
import { PlatformDashboard } from "@/pages/PlatformDashboard";
import { PlatformUsers } from "@/pages/PlatformUsers";
import { DeveloperSettings } from "@/pages/DeveloperSettings";
import { Products } from "@/pages/Products";
import { ProductEdit } from "@/pages/ProductEdit";
import { Inventory } from "@/pages/Inventory";
import { Vendors } from "@/pages/Vendors";
import { Categories } from "@/pages/Categories";
import { Attributes } from "@/pages/Attributes";
import { Offers } from "@/pages/Offers";
import { Discounts } from "@/pages/Discounts";
import { Orders } from "@/pages/Orders";
import { OrderDetail } from "@/pages/OrderDetail";
import { Returns } from "@/pages/Returns";
import { Users } from "@/pages/Users";
import { Permissions } from "@/pages/Permissions";
import { Customers } from "@/pages/Customers";
import { Tenants } from "@/pages/Tenants";
import { Settings } from "@/pages/Settings";
import { Tax } from "@/pages/Tax";
import { Shipping } from "@/pages/Shipping";
import { Payments } from "@/pages/Payments";
import { Notifications } from "@/pages/Notifications";
import { Pages } from "@/pages/Pages";
import { PageBuilder } from "@/pages/PageBuilder";
import { Reports, ReportDetail } from "@/pages/Reports";
import { Exports } from "@/pages/Exports";

function Protected({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function SuperAdminOnly({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "superadmin") return <Navigate to="/" replace />;
  return <>{children}</>;
}

// Wrap each page in a RouteErrorBoundary so a crash on one page
// shows an error UI instead of a blank screen, and navigating to
// another route remounts the boundary cleanly.
function Page({ children }: { children: React.ReactNode }) {
  return (
    <RouteErrorBoundary>
      {children}
    </RouteErrorBoundary>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/setup" element={<Setup />} />
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        {/* Platform routes (superadmin only) */}
        <Route path="platform-dashboard" element={<SuperAdminOnly><Page><PlatformDashboard /></Page></SuperAdminOnly>} />
        <Route path="platform-users" element={<SuperAdminOnly><Page><PlatformUsers /></Page></SuperAdminOnly>} />
        <Route path="dev-settings" element={<SuperAdminOnly><Page><DeveloperSettings /></Page></SuperAdminOnly>} />
        <Route path="tenants" element={<SuperAdminOnly><Page><Tenants /></Page></SuperAdminOnly>} />

        {/* Tenant-scoped routes */}
        <Route index element={<Page><Dashboard /></Page>} />
        <Route path="products" element={<Page><Products /></Page>} />
        <Route path="inventory" element={<Page><Inventory /></Page>} />
        <Route path="vendors" element={<Page><Vendors /></Page>} />
        <Route path="products/new" element={<Page><ProductEdit /></Page>} />
        <Route path="products/:id/edit" element={<Page><ProductEdit /></Page>} />
        <Route path="categories" element={<Page><Categories /></Page>} />
        <Route path="attributes" element={<Page><Attributes /></Page>} />
        <Route path="offers" element={<Page><Offers /></Page>} />
        <Route path="discounts" element={<Page><Discounts /></Page>} />
        <Route path="orders" element={<Page><Orders /></Page>} />
        <Route path="orders/:orderId" element={<Page><OrderDetail /></Page>} />
        <Route path="returns" element={<Page><Returns /></Page>} />
        <Route path="tax" element={<Page><Tax /></Page>} />
        <Route path="shipping" element={<Page><Shipping /></Page>} />
        <Route path="payments" element={<Page><Payments /></Page>} />
        <Route path="notifications" element={<Page><Notifications /></Page>} />
        <Route path="pages" element={<Page><Pages /></Page>} />
        <Route path="pages/:id/edit" element={<Page><PageBuilder /></Page>} />
        <Route path="users" element={<Page><Users /></Page>} />
        <Route path="permissions" element={<Page><Permissions /></Page>} />
        <Route path="customers" element={<Page><Customers /></Page>} />
        <Route path="reports" element={<Page><Reports /></Page>} />
        <Route path="reports/:type" element={<Page><ReportDetail /></Page>} />
        <Route path="exports" element={<Page><Exports /></Page>} />
        <Route path="settings" element={<Page><Settings /></Page>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
