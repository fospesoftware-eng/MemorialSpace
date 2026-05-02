import { Router, type IRouter } from "express";
import healthRouter from "./health";
import organizationsRouter from "./organizations";
import usersRouter from "./users";
import plotsRouter from "./plots";
import burialsRouter from "./burials";
import bookingsRouter from "./bookings";
import memorialsRouter from "./memorials";
import workOrdersRouter from "./workOrders";
import qrCodesRouter from "./qrCodes";
import obituariesRouter from "./obituaries";
import marketplaceRouter from "./marketplace";
import dashboardRouter from "./dashboard";
import publicApiRouter from "./publicApi";
import aiMapRouter from "./aiMap";
import columbariaRouter from "./columbaria";

const router: IRouter = Router();

router.use(healthRouter);
router.use(organizationsRouter);
router.use(usersRouter);
router.use(plotsRouter);
router.use(burialsRouter);
router.use(bookingsRouter);
router.use(memorialsRouter);
router.use(workOrdersRouter);
router.use(qrCodesRouter);
router.use(obituariesRouter);
router.use(marketplaceRouter);
router.use(dashboardRouter);
router.use(publicApiRouter);
router.use(aiMapRouter);
router.use(columbariaRouter);

export default router;
