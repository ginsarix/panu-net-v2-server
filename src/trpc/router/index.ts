import { router } from '../';
import { authRouter } from './auth.ts';
import { companyRouter } from './company.ts';
import { creditorRouter } from './creditor.ts';
import { debtorRouter } from './debtor.ts';
import { userRouter } from './user.ts';

export const appRouter = router({
  user: userRouter,
  auth: authRouter,
  company: companyRouter,
  debtor: debtorRouter,
  creditor: creditorRouter,
});

export type AppRouter = typeof appRouter;
