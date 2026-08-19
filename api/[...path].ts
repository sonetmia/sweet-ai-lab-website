import express from "express";
import { registerAdminRoutes } from "../server/adminApi";
import { registerStudioRoutes } from "../server/studioApi";

const app = express();

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
registerStudioRoutes(app);
registerAdminRoutes(app);

export default app;
