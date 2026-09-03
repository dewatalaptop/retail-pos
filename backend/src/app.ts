import express from "express";
import cors from "cors";
import { authRouter } from "./routes/auth";
import { productsRouter } from "./routes/products";
import { transactionsRouter } from "./routes/transactions";
import { reportsRouter } from "./routes/reports";
import { settingsRouter } from "./routes/settings";
import { heldCartsRouter } from "./routes/heldCarts";
import { cashiersRouter } from "./routes/cashiers";

export const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRouter);
app.use("/api/products", productsRouter);
app.use("/api/transactions", transactionsRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/held-carts", heldCartsRouter);
app.use("/api/cashiers", cashiersRouter);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(err.status ?? 500).json({ error: err.message ?? "Terjadi kesalahan pada server" });
});
