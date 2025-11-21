export const emailVerificationTemplate = (code: string) => `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>E-Posta Doğrulama</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif">
<div style="display:none;max-height:0;overflow:hidden">Doğrulama kodunuz: ${code}. 5 dakika geçerli.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#0a0a0a;padding:40px 20px">
<tr><td align="center">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="max-width:480px;width:100%;background:linear-gradient(180deg,#1a1a1a,#121212);border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,.4);border:1px solid #2a2a2a">
<tr><td style="padding:48px 32px;text-align:center">
<h1 style="margin:0 0 16px;font-size:28px;font-weight:600;letter-spacing:-.5px;color:#B9F6CA;line-height:1.2">E-Posta Doğrulama</h1>
<p style="font-size:16px;color:#e0e0e0;margin:0 0 32px;line-height:1.5;opacity:.9">Hesabınıza giriş yapmak için aşağıdaki<br>doğrulama kodunu kullanın.</p>
<div style="background:#1e3a1e;border:2px solid #2d5a2d;border-radius:12px;padding:20px 24px;margin:0 auto 32px;display:inline-block;box-shadow:0 4px 16px rgba(0,0,0,.3)">
<div style="font-size:36px;font-weight:700;color:#B9F6CA;letter-spacing:8px;font-family:'Courier New',monospace">${code}</div>
</div>
<div style="background:rgba(255,193,7,.1);border-left:3px solid #ffc107;padding:16px;border-radius:8px;margin-bottom:32px;text-align:left">
<p style="margin:0;color:#ffd54f;font-size:14px;line-height:1.5">⏱️ <strong>Bu kod 5 dakika boyunca geçerlidir.</strong><br><span style="opacity:.8">Süre dolmadan kodu girin.</span></p>
</div>
<div style="background:rgba(244,67,54,.1);border-left:3px solid #ef5350;padding:16px;border-radius:8px;margin-bottom:32px;text-align:left">
<p style="margin:0;color:#ef9a9a;font-size:14px;line-height:1.5;opacity:.85">Bu işlemi siz yapmadıysanız destek ekibimizle iletişime geçiniz.</p>
</div>
<div style="margin:32px 0;height:1px;background:linear-gradient(90deg,transparent,#2d5a2d,transparent)"></div>
<p style="color:#999;font-size:13px;margin:0;line-height:1.6;opacity:.7">Bu e-posta <a href="https://panunet.com.tr" style="color:#66bb6a;text-decoration:none;font-weight:500">PanuNet V2</a> tarafından otomatik olarak gönderilmiştir.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
