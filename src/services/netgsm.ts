import Netgsm from '@netgsm/sms';

export const netgsm = new Netgsm({
  username: process.env.NETGSM_USERNAME!,
  password: process.env.NETGSM_PASSWORD!,
  appname: 'PanuNet V2',
});
