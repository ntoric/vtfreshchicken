import { useState, useEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { X, ChevronDown } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { TopNavbar } from "@/components/TopNavbar";
import type { UserRole } from "@/types";

interface NavItem {
  to: string;
  label: string;
  icon: string;
  roles?: UserRole[];
}

interface NavGroup {
  label: string;
  icon: string;
  children: NavItem[];
}

interface NavSection {
  title: string;
  items: (NavItem | NavGroup)[];
}

// Type guard to distinguish flat items from collapsible groups
function isNavGroup(item: NavItem | NavGroup): item is NavGroup {
  return (item as NavGroup).children !== undefined;
}


// Group header icons
const CATALOG_ICON = "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4";
const SALES_ICON = "M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z";
const PROMO_ICON = "M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z M6 6h.008v.008H6V6z";
const LOGISTICS_ICON = "M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-6m6 0V9.348c0-.621-.504-1.125-1.125-1.125H4.125c-.621 0-1.125.504-1.125 1.125v9.402c0 .621.504 1.125 1.125 1.125H7.5m6-12H9.75m6 0a8.997 8.997 0 013.75 7.5M9.75 18.75h6";
const CONTENT_ICON = "M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z";
const ADMIN_ICON = "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z";

const SECTIONS: NavSection[] = [
  {
    title: "Store",
    items: [
      { to: "/", label: "Dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
      {
        label: "Catalog",
        icon: CATALOG_ICON,
        children: [
          { to: "/products", label: "Products", icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" },
          { to: "/categories", label: "Categories", icon: "M4 6h16M4 10h16M4 14h16M4 18h16" },
          { to: "/attributes", label: "Attributes", icon: "M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" },
          { to: "/inventory", label: "Inventory", icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4M7 12h10M7 16h6" },
          { to: "/vendors", label: "Vendors", icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H4m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5" },
        ],
      },
      {
        label: "Sales",
        icon: SALES_ICON,
        children: [
          { to: "/orders", label: "Orders", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
          { to: "/returns", label: "Returns", icon: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" },
          { to: "/payments", label: "Payments", icon: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" },
        ],
      },
      {
        label: "Promotions",
        icon: PROMO_ICON,
        children: [
          { to: "/offers", label: "Offers", icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" },
          { to: "/discounts", label: "Discounts", icon: "M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" },
        ],
      },
      {
        label: "Logistics",
        icon: LOGISTICS_ICON,
        children: [
          { to: "/tax", label: "Tax", icon: "M19.5 4.5 4.5 19.5M6.75 9a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5ZM17.25 19.5a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Z" },
          { to: "/shipping", label: "Shipping", icon: "M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1" },
        ],
      },
      { to: "/customers", label: "Customers", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
      { to: "/reports", label: "Reports", icon: "M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" },
      { to: "/exports", label: "Exports", icon: "M12 3v12m0 0l-4-4m4 4l4-4M3 17v3a1 1 0 001 1h16a1 1 0 001-1v-3" },
      {
        label: "Content",
        icon: CONTENT_ICON,
        children: [
          { to: "/pages", label: "Page Builder", icon: "M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
          { to: "/notifications", label: "Notifications", icon: "M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022 23.848 23.848 0 005.454 1.31m6.715 0a24.255 24.255 0 01-6.715 0m6.715 0a3 3 0 11-6.715 0" },
        ],
      },
      {
        label: "Administration",
        icon: ADMIN_ICON,
        children: [
          { to: "/users", label: "Users & Staff", icon: "M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.353 9.28 9.28 0 0 0-1.876-.272M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" },
          { to: "/branches", label: "Branches", icon: "M15 10.5a3 3 0 11-6 0 3 3 0 016 0z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" },
          { to: "/permissions", label: "Permissions", icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" },
          { to: "/developer", label: "Developer", icon: "M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-3 13.5", roles: ["superadmin"] },
          { to: "/settings", label: "Settings", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" },
        ],
      },
    ],
  },
];

// Helper class: visible on mobile (drawer) and desktop-hover, hidden on desktop-collapsed
const expandLabel = "block md:hidden md:group-hover:block";

export function Layout() {
  const { user, tenantName } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Branch-scoped backoffice lives under /b/:slug — strip the prefix for
  // active-state matching and re-apply it to nav links. The /branches admin
  // page itself stays global.
  const branchPrefix = location.pathname.match(/^\/b\/[^/]+/)?.[0] ?? "";
  const scopedPath = branchPrefix ? location.pathname.slice(branchPrefix.length) || "/" : location.pathname;
  // Global pages that must not be prefixed with the branch scope.
  const navTo = (to: string) => (to === "/branches" || to === "/developer" ? to : branchPrefix + to);

  // Track which collapsible groups are expanded. A group key is its label.
  // Groups auto-expand when any child route is active.
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // On route change: auto-expand any group containing the active route, and close mobile sidebar
  useEffect(() => {
    setSidebarOpen(false);
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      for (const section of SECTIONS) {
        for (const item of section.items) {
          if (isNavGroup(item) && item.children.some((c) => scopedPath === c.to || (c.to !== "/" && scopedPath.startsWith(c.to))) ) {
            next.add(item.label);
          }
        }
      }
      return next;
    });
  }, [location.pathname]);

  const toggleGroup = (label: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  // Hide nav entries restricted to other roles (items without `roles` are
  // visible to everyone). Groups are hidden when all their children are.
  const role = user?.role;
  const visibleSections = SECTIONS.map((section) => ({
    ...section,
    items: section.items
      .map((item) =>
        isNavGroup(item)
          ? { ...item, children: item.children.filter((c) => !c.roles || (!!role && c.roles.includes(role))) }
          : item,
      )
      .filter((item) =>
        isNavGroup(item)
          ? item.children.length > 0
          : !item.roles || (!!role && item.roles.includes(role)),
      ),
  }));

  const brandName = tenantName || "Store";
  const brandSubtitle = "Admin Panel";

  return (
    <div className="min-h-screen flex">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — collapsed (icons only) on desktop, expands on hover; full drawer on mobile */}
      <aside
        className={`group bg-slate-900 text-slate-300 flex flex-col fixed h-full z-50 overflow-hidden
          transition-all duration-300
          w-64 md:w-16 md:hover:w-64 md:hover:shadow-2xl
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
      >
        {/* Brand header */}
        <div className="px-3 md:px-2 py-5 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white font-bold text-lg">
            <span className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center text-sm flex-shrink-0 mx-auto md:mx-0">
              {brandName.charAt(0).toUpperCase() || "S"}
            </span>
            <span className={`truncate ${expandLabel}`}>{brandName}</span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className={`px-5 -mt-2 pb-1 text-xs text-slate-500 ${expandLabel}`}>{brandSubtitle}</p>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-3 space-y-4">
          {visibleSections.map((section) => (
            <div key={section.title}>
              <p className={`px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 ${expandLabel}`}>
                {section.title}
              </p>
              <div className="space-y-1">
                {section.items.map((item, idx) => {
                  if (isNavGroup(item)) {
                    const isExpanded = expandedGroups.has(item.label);
                    const hasActiveChild = item.children.some(
                      (c) => scopedPath === c.to || (c.to !== "/" && scopedPath.startsWith(c.to)),
                    );
                    return (
                      <div key={item.label}>
                        {/* Group header — clickable to toggle expansion */}
                        <button
                          onClick={() => toggleGroup(item.label)}
                          title={item.label}
                          className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition
                            md:justify-center md:group-hover:justify-start
                            ${hasActiveChild ? "text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"}`}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                          </svg>
                          <span className={`flex-1 text-left ${expandLabel}`}>{item.label}</span>
                          <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""} ${expandLabel}`} />
                        </button>
                        {/* Children — visible when group is expanded AND sidebar is expanded (mobile drawer or desktop hover) */}
                        {isExpanded && (
                          <div className={`space-y-0.5 mt-0.5 ${expandLabel}`}>
                            {item.children.map((child) => (
                              <NavLink
                                key={child.to}
                                to={navTo(child.to)}
                                end={child.to === "/"}
                                title={child.label}
                                className={({ isActive }) =>
                                  `flex items-center gap-3 pl-9 pr-3 py-2 rounded-lg text-sm transition
                                    ${isActive
                                      ? "bg-brand/20 text-white font-medium"
                                      : "text-slate-400 hover:bg-slate-800 hover:text-white"
                                    }`
                                }
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d={child.icon} />
                                </svg>
                                <span>{child.label}</span>
                              </NavLink>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  }
                  // Flat item (no group)
                  return (
                    <NavLink
                      key={item.to}
                      to={navTo(item.to)}
                      end={item.to === "/"}
                      title={item.label}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition
                          md:justify-center md:group-hover:justify-start
                          ${isActive
                            ? "bg-brand text-white"
                            : "text-slate-300 hover:bg-slate-800 hover:text-white"
                          }`
                      }
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                      </svg>
                      <span className={expandLabel}>{item.label}</span>
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-slate-700 p-4" />
      </aside>

      {/* Main content */}
      <div className="flex-1 md:ml-16 w-full min-w-0">
        {/* Top navbar — frosted glass, visible on all screen sizes */}
        <TopNavbar onOpenSidebar={() => setSidebarOpen(true)} />

        <main className="p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
