import { Netgsm } from '@netgsm/sms';

import { env } from '../config/env.js';

export const netgsm = new Netgsm({
  username: env.NETGSM_USERNAME,
  password: env.NETGSM_PASSWORD,
  appname: 'PanuNet V2',
});

class NetgsmError extends Error {}
export async function sendRestSms({
  messages,
  msgheader,
}: {
  messages: { msg: string; no: string }[];
  msgheader: string;
}) {
  try {
    const result = await netgsm.sendRestSms({ messages, msgheader });
    return result;
  } catch (error) {
    throw new NetgsmError(`Failed to send SMS: ${error as Error}`);
  }
}
