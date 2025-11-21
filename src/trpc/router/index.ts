import { router } from '../index.js';
import { authRouter } from './auth.js';
import { companyRouter } from './company.js';
import { creditorRouter } from './creditor.js';
import { debtorRouter } from './debtor.js';
import { pageRoleRouter } from './page-role.js';
import { reportRouter } from './report.js';
import { subscriptionCustomerRouter } from './subscription-customer.js';
import { subscriptionRouter } from './subscription.js';
import { userRouter } from './user.js';
import { contractRouter } from './contract.js';
import { stockRouter } from './stock.js';

export const appRouter = router({
  user: userRouter,
  auth: authRouter,
  company: companyRouter,
  debtor: debtorRouter,
  creditor: creditorRouter,
  subscription: subscriptionRouter,
  subscriptionCustomer: subscriptionCustomerRouter,
  report: reportRouter,
  pageRole: pageRoleRouter,
  contract: contractRouter,
  stock: stockRouter,
});

export type AppRouter = typeof appRouter;
