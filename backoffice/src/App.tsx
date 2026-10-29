import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Layout } from "@/components/Layout";
import { ModuleGate } from "@/components/ModuleGate";
import { RouteErrorBoundary } from "@/components/ErrorBoundary";
import { BranchGuard } from "@/lib/branch";
import { Login } from "@/pages/Login";
import { PlatformLogin } from "@/pages/PlatformLogin";
import { Setup } from "@/pages/Setup";
import { Dashboard } from "@/pages/Dashboard";
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
import { Reviews } from "@/pages/Reviews";
import { Users } from "@/pages/Users";
import { Permissions } from "@/pages/Permissions";
import { Customers } from "@/pages/Customers";
import { Settings } from "@/pages/Settings";
import { Tax } from "@/pages/Tax";
import { Shipping } from "@/pages/Shipping";
import { Payments } from "@/pages/Payments";
import { Notifications } from "@/pages/Notifications";
import { Pages } from "@/pages/Pages";
import { PageBuilder } from "@/pages/PageBuilder";
import { ContactSubmissions } from "@/pages/ContactSubmissions";
import { Reports, ReportDetail } from "@/pages/Reports";
import { Exports } from "@/pages/Exports";
import { Branches } from "@/pages/Branches";
import { BranchEdit } from "@/pages/BranchEdit";
import { Developer } from "@/pages/Developer";
import { DeliveryLogin } from "@/pages/DeliveryLogin";
import { Delivery } from "@/pages/Delivery";
import { DeliveryLayout } from "@/components/DeliveryLayout";

function Protected({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
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

// The page tree is shared between the global view (/) and each
// branch-scoped backoffice (/b/:slug/...).
const pageRoutes = (
  <>
    <Route index element={<Page><Dashboard /></Page>} />
    <Route path="products" element={<Page><Products /></Page>} />
    <Route path="inventory" element={<Page><Inventory /></Page>} />
    <Route path="vendors" element={<Page><Vendors /></Page>} />
    <Route path="products/new" element={<Page><ProductEdit /></Page>} />
    <Route path="products/:id/edit" element={<Page><ProductEdit /></Page>} />
    <Route path="categories" element={<Page><Categories /></Page>} />
    <Route path="attributes" element={<Page><Attributes /></Page>} />
    <Route path="offers" element={<Page><ModuleGate module="promotions"><Offers /></ModuleGate></Page>} />
    <Route path="discounts" element={<Page><ModuleGate module="discounts"><Discounts /></ModuleGate></Page>} />
    <Route path="orders" element={<Page><Orders /></Page>} />
    <Route path="orders/:orderId" element={<Page><OrderDetail /></Page>} />
    <Route path="returns" element={<Page><ModuleGate module="returns"><Returns /></ModuleGate></Page>} />
    <Route path="tax" element={<Page><ModuleGate module="tax"><Tax /></ModuleGate></Page>} />
    <Route path="shipping" element={<Page><ModuleGate module="shipping"><Shipping /></ModuleGate></Page>} />
    <Route path="payments" element={<Page><Payments /></Page>} />
    <Route path="notifications" element={<Page><Notifications /></Page>} />
    <Route path="pages" element={<Page><ModuleGate module="page_builder"><Pages /></ModuleGate></Page>} />
    <Route path="pages/:id/edit" element={<Page><ModuleGate module="page_builder"><PageBuilder /></ModuleGate></Page>} />
    <Route path="contact-submissions" element={<Page><ContactSubmissions /></Page>} />
    <Route path="users" element={<Page><Users /></Page>} />
    <Route path="permissions" element={<Page><Permissions /></Page>} />
    <Route path="customers" element={<Page><Customers /></Page>} />
    <Route path="reviews" element={<Page><Reviews /></Page>} />
    <Route path="reports" element={<Page><Reports /></Page>} />
    <Route path="reports/:type" element={<Page><ReportDetail /></Page>} />
    <Route path="exports" element={<Page><Exports /></Page>} />
    <Route path="settings" element={<Page><Settings /></Page>} />
  </>
);

export default function App() {
  return (
    <Routes>
      <Route path="/setup" element={<Setup />} />
      <Route path="/login" element={<Login />} />
      {/* Hidden platform login — intentionally unlinked from the UI */}
      <Route path="/root-access" element={<PlatformLogin />} />
      {/* Delivery partner portal */}
      <Route path="/delivery/login" element={<DeliveryLogin />} />
      <Route path="/delivery" element={<DeliveryLayout />}>
        <Route index element={<Page><Delivery /></Page>} />
      </Route>
      <Route
        path="/"
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        {/* Global (all branches) routes */}
        {pageRoutes}
        {/* Branch administration lives at the root level */}
        <Route path="branches" element={<Page><Branches /></Page>} />
        <Route path="branches/new" element={<Page><BranchEdit /></Page>} />
        <Route path="branches/:id/edit" element={<Page><BranchEdit /></Page>} />
        {/* Developer settings — superadmin only (the page itself also guards) */}
        <Route path="developer" element={<Page><Developer /></Page>} />
        {/* Branch-scoped backoffice: /b/:slug/... */}
        <Route path="b/:slug" element={<BranchGuard />}>
          {pageRoutes}
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
