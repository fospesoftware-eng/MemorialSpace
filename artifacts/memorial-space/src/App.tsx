import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import NotFound from "@/pages/not-found";

import { B2BLayout } from "@/components/layout/b2b-layout";
import { PublicLayout } from "@/components/layout/public-layout";
import { CustomerLayout } from "@/components/layout/customer-layout";
import { AdminLayout } from "@/components/layout/admin-layout";
import { SaasMarketingLayout } from "@/components/layout/saas-marketing-layout";

// SaaS marketing
import SaasHome from "@/pages/marketing/saas-home";
import DemoCredentials from "@/pages/marketing/demo";

// Auth (sign-in)
import SignInHub from "@/pages/auth/sign-in-hub";
import SignInCemetery from "@/pages/auth/sign-in-cemetery";
import SignInFamily from "@/pages/auth/sign-in-family";
import SignInAdmin from "@/pages/auth/sign-in-admin";

// B2B (cemetery client)
import Dashboard from "@/pages/b2b/dashboard";
import Plots from "@/pages/b2b/plots";
import MapPage from "@/pages/b2b/map";
import MapMaker from "@/pages/b2b/map-maker";
import AiMapMaker from "@/pages/b2b/ai-map-maker";
import Columbarium from "@/pages/b2b/columbarium";
import Burials from "@/pages/b2b/burials";
import Bookings from "@/pages/b2b/bookings";
import WorkOrders from "@/pages/b2b/work-orders";
import Memorials from "@/pages/b2b/memorials";
import Obituaries from "@/pages/b2b/obituaries";
import QrCodes from "@/pages/b2b/qr-codes";
import Marketplace from "@/pages/b2b/marketplace";
import Organizations from "@/pages/settings/organizations";
import Users from "@/pages/settings/users";
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
        <Route path="/plots" component={Plots} />
        <Route path="/burials" component={Burials} />
        <Route path="/bookings" component={Bookings} />
        <Route path="/work-orders" component={WorkOrders} />
        <Route path="/memorials" component={Memorials} />
        <Route path="/obituaries" component={Obituaries} />
        <Route path="/qr-codes" component={QrCodes} />
        <Route path="/marketplace" component={Marketplace} />
        <Route path="/organizations" component={Organizations} />
        <Route path="/users" component={Users} />
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

      <Route path="/find" nest><PublicRoutes /></Route>
      <Route path="/account" nest><CustomerRoutes /></Route>
      <Route path="/admin" nest><AdminRoutes /></Route>
      <Route path="/app" nest><B2BRoutes /></Route>
      <Route path="/demo">
        <SaasMarketingRoutes><DemoCredentials /></SaasMarketingRoutes>
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
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
