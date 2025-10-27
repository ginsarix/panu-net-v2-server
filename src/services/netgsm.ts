import { Netgsm } from '@netgsm/sms';

import { env } from '../config/env.js';

export const netgsm = new Netgsm({
  username: env.NETGSM_USERNAME,
  password: env.NETGSM_PASSWORD,
  appname: 'PanuNet V2',
});
