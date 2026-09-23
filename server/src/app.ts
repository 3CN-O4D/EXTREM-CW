import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import { config } from './config';
import { HttpError } from './utils';
import usersRouter from './routes/users';
import transactionsRouter from './routes/transactions';
import expensesRouter from './routes/expenses';
import repaymentsRouter from './routes/repayments';
import statsRouter from './routes/stats';
import tipsRouter from './routes/tips';
import debtsRouter from './routes/debts';
import carpetsRouter from './routes/carpets';

export function createApp() {
  const app = express();

  app.use(cors({ origin: config.corsOrigins, credentials: true }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  app.get('/', (_req: Request, res: Response) => {
    res.json({ message: 'Welcome to Carwash POS API' });
  });

  app.use('/api/v1/auth', usersRouter);
  app.use('/api/v1/transactions', transactionsRouter);
  app.use('/api/v1/expenses', expensesRouter);
  app.use('/api/v1/repayments', repaymentsRouter);
  app.use('/api/v1/stats', statsRouter);
  app.use('/api/v1/tips', tipsRouter);
  app.use('/api/v1/debts', debtsRouter);
  app.use('/api/v1/carpets', carpetsRouter);

  // 404
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ detail: 'Not Found' });
  });

  // Error handler
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) {
      if (err.headers) res.set(err.headers);
      res.status(err.statusCode).json({ detail: err.message });
      return;
    }
    console.error(err);
    res.status(500).json({ detail: 'Internal Server Error' });
  });

  return app;
}