import { router } from '../';
import { companyRouter } from './company.ts';
import { debtorRouter } from './debtor.ts';
import { userRouter } from './user.ts';

export const appRouter = router({
  user: userRouter,
  company: companyRouter,
  debtor: debtorRouter,
});

export type AppRouter = typeof appRouter;
