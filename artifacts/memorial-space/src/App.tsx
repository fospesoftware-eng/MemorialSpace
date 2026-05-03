import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider, RequireAuth } from "@/lib/auth";
import NotFound from "@/pages/not-found";

import { B2BLayout } from "@/components/layout/b2b-layout";
import { PublicLayout } from "@/components/layout/public-layout";
import { CustomerLayout } from "@/components/layout/customer-layout";
import { AdminLayout } from "@/components/layout/admin-layout";
import { SaasMarketingLayout } from "@/components/layout/saas-marketing-layout";

// SaaS marketing
import SaasHome from "@/pages/marketing/saas-home";
import DemoCredentials from "@/pages/marketing/demo";
import FeaturesPage from "@/pages/marketing/features";
import PricingPage from "@/pages/marketing/pricing";
import ContactPage from "@/pages/marketing/contact";
import TutorialHubPage from "@/pages/marketing/tutorial-hub";
import TutorialCemeteryPage from "@/pages/marketing/tutorial-cemetery";
import TutorialFamilyPage from "@/pages/marketing/tutorial-family";

// Auth (sign-in)
import SignInHub from "@/pages/auth/sign-in-hub";
import SignInCemetery from "@/pages/auth/sign-in-cemetery";
import SignInFamily from "@/pages/auth/sign-in-family";
import SignInAdmin from "@/pages/auth/sign-in-admin";
import SignInVendor from "@/pages/auth/sign-in-vendor";
import SignupCemetery from "@/pages/auth/signup-cemetery";

// Vendor (marketplace)
import VendorSignup from "@/pages/vendor/signup";
import VendorDashboard from "@/pages/vendor/dashboard";
import VendorProfile from "@/pages/vendor/profile";
import VendorServices from "@/pages/vendor/services";
import VendorRequests from "@/pages/vendor/requests";
import VendorOrders from "@/pages/vendor/orders";
import VendorCustomers from "@/pages/vendor/customers";
import { VendorLayout } from "@/components/layout/vendor-layout";
import VendorsDirectory from "@/pages/public/vendors-directory";
import VendorDetail from "@/pages/public/vendor-detail";

// B2B (cemetery client)
import Dashboard from "@/pages/b2b/dashboard";
import Plots from "@/pages/b2b/plots";
import MapPage from "@/pages/b2b/map";
import MapMaker from "@/pages/b2b/map-maker";
import AiMapMaker from "@/pages/b2b/ai-map-maker";
import Columbarium from "@/pages/b2b/columbarium";
import Mausoleum from "@/pages/b2b/mausoleum";
import Burials from "@/pages/b2b/burials";
import Bookings from "@/pages/b2b/bookings";
import WorkOrders from "@/pages/b2b/work-orders";
import Assets from "@/pages/b2b/assets";
import Maintenance from "@/pages/b2b/maintenance";
import Expenses from "@/pages/b2b/expenses";
import Memorials from "@/pages/b2b/memorials";
import Obituaries from "@/pages/b2b/obituaries";
import QrCodes from "@/pages/b2b/qr-codes";
import Marketplace from "@/pages/b2b/marketplace";
import SiteBuilder from "@/pages/b2b/site-builder";
import { CemeterySiteRoutes } from "@/pages/cemetery-site";
import AccountingOverview from "@/pages/b2b/accounting/overview";
import AccountingCustomers from "@/pages/b2b/accounting/customers";
import AccountingTaxRates from "@/pages/b2b/accounting/tax-rates";
import AccountingInvoicesList from "@/pages/b2b/accounting/invoices-list";
import AccountingInvoiceEdit from "@/pages/b2b/accounting/invoice-edit";
import AccountingInvoiceDetail from "@/pages/b2b/accounting/invoice-detail";
import Organizations from "@/pages/settings/organizations";
import TeamPage from "@/pages/team";
import TeamRolesPage from "@/pages/team/roles";
import Settings from "@/pages/settings/general";
import CemeteryTypes from "@/pages/settings/cemetery-types";

// B2C public marketing
import GraveSearch from "@/pages/public/grave-search";
import PublicMemorial from "@/pages/public/memorial";
import PublicObituaries from "@/pages/public/obituaries";
import PublicShop from "@/pages/public/shop";

// Customer (B2C) dashboard
import CustomerDashboard from "@/pages/customer/dashboard";
import CustomerOrders from "@/pages/customer/orders";
import CustomerMemorials from "@/pages/customer/memorials";
import CustomerTributes from "@/pages/customer/tributes";
import CustomerSaved from "@/pages/customer/saved";
import CustomerSettings from "@/pages/customer/settings";

// SaaS admin
import AdminDashboard from "@/pages/admin/dashboard";
import AdminOrganizations from "@/pages/admin/organizations";
import AdminUsers from "@/pages/admin/users";
import AdminBilling from "@/pages/admin/billing";
import AdminAnalytics from "@/pages/admin/analytics";
import AdminSupport from "@/pages/admin/support";

const queryClient = new QueryClient();

function B2BRoutes() {
  // Map Maker is a fullscreen editor — render it outside the B2BLayout chrome so it
  // can use the entire viewport (no sidebar / max-w-7xl constraints).
  const [location] = useLocation();
  if (location === "/map-maker") return <MapMaker />;

  return (
    <B2BLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/map" component={MapPage} />
        <Route path="/ai-map-maker" component={AiMapMaker} />
        <Route path="/columbarium" component={Columbarium} />
        <Route path="/columbarium/:id" component={Columbarium} />
        <Route path="/mausoleum" component={Mausoleum} />
        <Route path="/mausoleum/:id" component={Mausoleum} />
        <Route path="/plots" component={Plots} />
        <Route path="/burials" component={Burials} />
        <Route path="/bookings" component={Bookings} />
        <Route path="/work-orders" component={WorkOrders} />
        <Route path="/assets" component={Assets} />
        <Route path="/maintenance" component={Maintenance} />
        <Route path="/expenses" component={Expenses} />
        <Route path="/memorials" component={Memorials} />
        <Route path="/obituaries" component={Obituaries} />
        <Route path="/qr-codes" component={QrCodes} />
        <Route path="/marketplace" component={Marketplace} />
        <Route path="/site-builder" component={SiteBuilder} />
        <Route path="/accounting" component={AccountingOverview} />
        <Route path="/accounting/customers" component={AccountingCustomers} />
        <Route path="/accounting/tax-rates" component={AccountingTaxRates} />
        <Route path="/accounting/invoices" component={AccountingInvoicesList} />
        <Route path="/accounting/invoices/new">
          <AccountingInvoiceEdit />
        </Route>
        <Route path="/accounting/invoices/:id/edit">
          {(params) => <AccountingInvoiceEdit invoiceId={Number(params.id)} />}
        </Route>
        <Route path="/accounting/invoices/:id">
          {(params) => <AccountingInvoiceDetail invoiceId={Number(params.id)} />}
        </Route>
        <Route path="/organizations" component={Organizations} />
        <Route path="/team" component={TeamPage} />
        <Route path="/team/roles" component={TeamRolesPage} />
        <Route path="/users" component={TeamPage} />
        <Route path="/settings" component={Settings} />
        <Route path="/cemetery-setup" component={CemeteryTypes} />
        <Route component={NotFound} />
      </Switch>
    </B2BLayout>
  );
}

function PublicRoutes() {
  return (
    <PublicLayout>
      <Switch>
        <Route path="/" component={GraveSearch} />
        <Route path="/memorial/:id" component={PublicMemorial} />
        <Route path="/obituaries" component={PublicObituaries} />
        <Route path="/shop" component={PublicShop} />
        <Route component={NotFound} />
      </Switch>
    </PublicLayout>
  );
}

function CustomerRoutes() {
  return (
    <CustomerLayout>
      <Switch>
        <Route path="/" component={CustomerDashboard} />
        <Route path="/orders" component={CustomerOrders} />
        <Route path="/memorials" component={CustomerMemorials} />
        <Route path="/tributes" component={CustomerTributes} />
        <Route path="/saved" component={CustomerSaved} />
        <Route path="/settings" component={CustomerSettings} />
        <Route component={NotFound} />
      </Switch>
    </CustomerLayout>
  );
}

function VendorRoutes() {
  return (
    <VendorLayout>
      <Switch>
        <Route path="/" component={VendorDashboard} />
        <Route path="/dashboard" component={VendorDashboard} />
        <Route path="/profile" component={VendorProfile} />
        <Route path="/services" component={VendorServices} />
        <Route path="/requests" component={VendorRequests} />
        <Route path="/orders" component={VendorOrders} />
        <Route path="/customers" component={VendorCustomers} />
        <Route component={NotFound} />
      </Switch>
    </VendorLayout>
  );
}

function AdminRoutes() {
  return (
    <AdminLayout>
      <Switch>
        <Route path="/" component={AdminDashboard} />
        <Route path="/organizations" component={AdminOrganizations} />
        <Route path="/users" component={AdminUsers} />
        <Route path="/billing" component={AdminBilling} />
        <Route path="/analytics" component={AdminAnalytics} />
        <Route path="/support" component={AdminSupport} />
        <Route component={NotFound} />
      </Switch>
    </AdminLayout>
  );
}

function SaasMarketingRoutes({ children }: { children: React.ReactNode }) {
  return <SaasMarketingLayout>{children}</SaasMarketingLayout>;
}

function Router() {
  return (
    <Switch>
      <Route path="/sign-in" component={SignInHub} />
      <Route path="/sign-in/cemetery" component={SignInCemetery} />
      <Route path="/sign-in/family" component={SignInFamily} />
      <Route path="/sign-in/admin" component={SignInAdmin} />
      <Route path="/sign-in/vendor" component={SignInVendor} />
      <Route path="/vendor/signup" component={VendorSignup} />

      {/* Public marketplace directory — anyone can browse vendors. */}
      <Route path="/vendors" component={VendorsDirectory} />
      <Route path="/vendors/:slug">
        {(params) => <VendorDetail slug={String(params.slug)} />}
      </Route>

      {/* Vendor-authed dashboard. Mounted under /vendor (parallel to /app, /account). */}
      <Route path="/vendor" nest>
        <RequireAuth kinds={["vendor"]} signInPath="/sign-in/vendor">
          <VendorRoutes />
        </RequireAuth>
      </Route>

      <Route path="/find" nest><PublicRoutes /></Route>
      <Route path="/c/:slug" nest>
        {(params) => <CemeterySiteRoutes slug={String(params.slug)} />}
      </Route>
      <Route path="/account" nest>
        <RequireAuth kinds={["family"]} signInPath="/sign-in/family">
          <CustomerRoutes />
        </RequireAuth>
      </Route>
      <Route path="/admin" nest>
        <RequireAuth kinds={["admin"]} signInPath="/sign-in/admin">
          <AdminRoutes />
        </RequireAuth>
      </Route>
      <Route path="/app" nest>
        <RequireAuth kinds={["cemetery"]} signInPath="/sign-in/cemetery">
          <B2BRoutes />
        </RequireAuth>
      </Route>
      <Route path="/demo">
        <SaasMarketingRoutes><DemoCredentials /></SaasMarketingRoutes>
      </Route>
      <Route path="/features">
        <SaasMarketingRoutes><FeaturesPage /></SaasMarketingRoutes>
      </Route>
      <Route path="/pricing">
        <SaasMarketingRoutes><PricingPage /></SaasMarketingRoutes>
      </Route>
      <Route path="/contact">
        <SaasMarketingRoutes><ContactPage /></SaasMarketingRoutes>
      </Route>
      <Route path="/signup/cemetery" component={SignupCemetery} />
      <Route path="/tutorial">
        <SaasMarketingRoutes><TutorialHubPage /></SaasMarketingRoutes>
      </Route>
      <Route path="/tutorial/cemetery">
        <SaasMarketingRoutes><TutorialCemeteryPage /></SaasMarketingRoutes>
      </Route>
      <Route path="/tutorial/family">
        <SaasMarketingRoutes><TutorialFamilyPage /></SaasMarketingRoutes>
      </Route>
      <Route path="/">
        <SaasMarketingRoutes><SaasHome /></SaasMarketingRoutes>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="dark">
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
