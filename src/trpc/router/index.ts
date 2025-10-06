import { router } from '../index';
import { authRouter } from './auth';
import { companyRouter } from './company';
import { creditorRouter } from './creditor';
import { debtorRouter } from './debtor';
import { reportRouter } from './report';
import { subscriptionRouter } from './subscription';
import { subscriptionCustomerRouter } from './subscription-customer';
import { userRouter } from './user';

export const appRouter = router({
  user: userRouter,
  auth: authRouter,
  company: companyRouter,
  debtor: debtorRouter,
  creditor: creditorRouter,
  subscription: subscriptionRouter,
  subscriptionCustomer: subscriptionCustomerRouter,
  report: reportRouter,
});

export type AppRouter = typeof appRouter;
