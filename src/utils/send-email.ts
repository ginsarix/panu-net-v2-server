import nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport/index.js';

import { env } from '../config/env.js';
import { getLogger } from '../services/logger.js';

export interface SendEmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

const isProd = env.NODE_ENV === 'production';

const mailNetworkOptions: SMTPTransport.Options = isProd
  ? { host: 'v2.panunet.com.tr', port: 465, secure: true }
  : { service: 'gmail' };

const transporter = nodemailer.createTransport({
  ...mailNetworkOptions,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});

export async function sendEmail({ to, subject, text, html }: SendEmailOptions): Promise<void> {
  try {
    await transporter.sendMail({
      from: `"PanuNet V2" <${env.SMTP_USER}>`,
      to,
      subject,
      text,
      html,
    });

    getLogger().info(`Email sent to ${to}`);
  } catch (error) {
    getLogger().error(error, 'Failed to send email');
    throw new Error(`Failed to send email: ${error as Error}`);
  }
}
