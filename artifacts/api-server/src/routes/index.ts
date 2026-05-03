import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import cemeterySignupRouter from "./cemeterySignup";
import organizationsRouter from "./organizations";
import usersRouter from "./users";
import plotsRouter from "./plots";
import burialsRouter from "./burials";
import burialFamilyLinksRouter from "./burialFamilyLinks";
import bookingsRouter from "./bookings";
import memorialsRouter from "./memorials";
import workOrdersRouter from "./workOrders";
import workOrderCommentsRouter from "./workOrderComments";
import assetsRouter from "./assets";
import maintenanceSchedulesRouter from "./maintenanceSchedules";
import expenseCategoriesRouter from "./expenseCategories";
import expensesRouter from "./expenses";
import qrCodesRouter from "./qrCodes";
import obituariesRouter from "./obituaries";
import marketplaceRouter from "./marketplace";
import dashboardRouter from "./dashboard";
import publicApiRouter from "./publicApi";
import aiMapRouter from "./aiMap";
import columbariaRouter from "./columbaria";
import mausoleumsRouter from "./mausoleums";
import customersRouter from "./customers";
import taxRatesRouter from "./taxRates";
import invoicesRouter from "./invoices";
import paymentsRouter from "./payments";
import accountingRouter from "./accounting";
import cemeterySitesRouter from "./cemeterySites";
import memorialRitualsRouter from "./memorialRituals";
import adminRouter from "./admin";
import paymentGatewayRouter from "./paymentGateway";
import { vendorPublicRouter, vendorAuthedRouter } from "./vendors";
import { requireAuth, requireOrgUser, requireVendor } from "../lib/auth";

const router: IRouter = Router();

// --- Public surface (no auth) -------------------------------------------------
// Health is needed for liveness probes. Auth is needed to sign in. publicApi
// (`/public/search`, `/public/obituaries`) and the cemetery-sites router both
// expose unauthenticated read-only endpoints used by public-facing cemetery
// websites (`/c/:slug/*`); per-route writes inside cemeterySites still gate
// themselves where appropriate.
router.use(healthRouter);
router.use(authRouter);
router.use(cemeterySignupRouter);
router.use(publicApiRouter);
router.use(cemeterySitesRouter);
router.use(memorialRitualsRouter);
// Public marketplace-vendor surface: signup, directory, public detail,
// and family request submission. The vendor-authed endpoints sit on a
// separate router gated by `requireVendor` further down.
router.use(vendorPublicRouter);

// --- Vendor-authenticated surface --------------------------------------------
// Path-scoped to `/vendor/*` so `requireVendor` ONLY fires for vendor-tier
// endpoints. Mounting the middleware at root would 403 every other request
// from cemetery/admin/anonymous users before they reach their proper router.
// (Public `/vendor/signup` is defined inside `vendorPublicRouter` mounted
// above, so Express matches it first and never reaches this gate.)
router.use("/vendor", requireVendor, vendorAuthedRouter);

// --- Platform admin surface ---------------------------------------------------
// adminRouter mounts its own `requirePlatformAdmin` middleware internally, so
// no extra guard is needed here.
router.use(adminRouter);

// --- Payment gateway (Stripe) -------------------------------------------------
// Hosts both `/admin/payment-gateway/*` (super admin) and
// `/orgs/me/payment-gateway/*` (cemetery owner) — each route gates itself
// with the appropriate middleware internally.
router.use(paymentGatewayRouter);

// --- B2B cemetery operator surface -------------------------------------------
// Everything below requires a signed-in cemetery user with an organizationId.
// `enforceOrgScope` (mounted globally in app.ts) then forces the session's
// organizationId onto every query/body so a forged `?organizationId=X` cannot
// reach across tenants.
const orgRouter: IRouter = Router();
orgRouter.use(requireOrgUser);
orgRouter.use(organizationsRouter);
orgRouter.use(usersRouter);
orgRouter.use(plotsRouter);
orgRouter.use(burialsRouter);
orgRouter.use(burialFamilyLinksRouter);
orgRouter.use(bookingsRouter);
orgRouter.use(memorialsRouter);
orgRouter.use(workOrdersRouter);
orgRouter.use(workOrderCommentsRouter);
orgRouter.use(assetsRouter);
orgRouter.use(maintenanceSchedulesRouter);
orgRouter.use(expenseCategoriesRouter);
orgRouter.use(expensesRouter);
orgRouter.use(qrCodesRouter);
orgRouter.use(obituariesRouter);
orgRouter.use(marketplaceRouter);
orgRouter.use(dashboardRouter);
orgRouter.use(columbariaRouter);
orgRouter.use(mausoleumsRouter);
orgRouter.use(customersRouter);
orgRouter.use(taxRatesRouter);
orgRouter.use(invoicesRouter);
orgRouter.use(paymentsRouter);
orgRouter.use(accountingRouter);
router.use(orgRouter);

// --- AI map detection ---------------------------------------------------------
// Heavy / cost-bearing endpoint — require any signed-in session. Kept separate
// because admins may also legitimately call it.
const aiRouter: IRouter = Router();
aiRouter.use(requireAuth);
aiRouter.use(aiMapRouter);
router.use(aiRouter);

export default router;
