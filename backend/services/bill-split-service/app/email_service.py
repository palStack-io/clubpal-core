import os
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

import aiosmtplib

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
FROM_NAME = os.getenv("FROM_NAME", "clubPal")
FROM_EMAIL = os.getenv("FROM_EMAIL") or SMTP_USER or "noreply@palstack.io"


async def _send(to_email: str, subject: str, html: str) -> bool:
    if not (SMTP_USER and SMTP_PASSWORD):
        print(f"[EMAIL DISABLED] To: {to_email} | Subject: {subject}")
        return True
    try:
        msg = MIMEMultipart("alternative")
        msg["From"] = f"{FROM_NAME} <{FROM_EMAIL}>"
        msg["To"] = to_email
        msg["Subject"] = subject
        msg.attach(MIMEText(html, "html"))

        if SMTP_PORT == 465:
            await aiosmtplib.send(
                msg,
                hostname=SMTP_HOST,
                port=SMTP_PORT,
                use_tls=True,
                username=SMTP_USER,
                password=SMTP_PASSWORD,
            )
        else:
            await aiosmtplib.send(
                msg,
                hostname=SMTP_HOST,
                port=SMTP_PORT,
                start_tls=True,
                username=SMTP_USER,
                password=SMTP_PASSWORD,
            )

        print(f"[EMAIL SENT] To: {to_email} | Subject: {subject}")
        return True
    except Exception as e:
        print(f"[EMAIL FAILED] To: {to_email} | {e}")
        return False


def _coral_header(event_name: str) -> str:
    return f"""
<div style="background:linear-gradient(135deg,#fb7185,#f43f5e);padding:28px 32px;
            border-radius:12px 12px 0 0;text-align:center;">
  <div style="font-size:22px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">
    club<span style="color:#fda4af;">Pal</span>
  </div>
  <div style="font-size:15px;color:rgba(255,255,255,0.88);margin-top:6px;font-weight:600;">
    {event_name}
  </div>
</div>"""


def _cta_button(label: str, url: str) -> str:
    return f"""
<p style="text-align:center;margin:28px 0 8px;">
  <a href="{url}"
     style="background:linear-gradient(135deg,#fb7185,#f43f5e);color:#ffffff;
            padding:13px 32px;text-decoration:none;border-radius:8px;
            display:inline-block;font-size:14px;font-weight:700;letter-spacing:0.2px;">
    {label}
  </a>
</p>
<p style="text-align:center;font-size:12px;color:#bbb;margin-top:4px;">
  Or copy this link:
  <a href="{url}" style="color:#f43f5e;word-break:break-all;">{url}</a>
</p>"""


async def send_member_email(
    to_email: str,
    member_name: str,
    payer_name: str,
    event_name: str,
    event_date: str,
    assigned_items: list,
    tax_share: float,
    tip_share: float,
    total_owed: float,
    payment_note: Optional[str],
    mark_paid_url: str,
) -> bool:
    subject = f"Your share for {event_name}"

    item_rows = "".join(
        f"""<tr>
          <td style="padding:8px 12px;font-size:14px;color:#333;border-bottom:1px solid #f0f0f0;">
            {item['name']}
          </td>
          <td style="padding:8px 12px;font-size:14px;color:#333;text-align:right;
                     border-bottom:1px solid #f0f0f0;">
            ${item['price']:.2f}
          </td>
        </tr>"""
        for item in assigned_items
    )

    payment_note_block = ""
    if payment_note:
        payment_note_block = f"""
<div style="background:#fff8f9;border:1px solid #fda4af;border-radius:8px;
            padding:14px 18px;margin:20px 0;text-align:center;">
  <p style="margin:0;font-size:14px;color:#444;">
    Pay <strong>{payer_name}</strong> via <strong>{payment_note}</strong>
  </p>
</div>"""

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>{subject}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f6;
             font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0"
         style="background:#f4f4f6;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0"
             style="max-width:600px;width:100%;">
        <tr><td>{_coral_header(event_name)}</td></tr>
        <tr>
          <td style="background:#ffffff;padding:36px 32px 28px;
                     border-radius:0 0 12px 12px;">
            <h1 style="margin:0 0 8px;font-size:20px;font-weight:800;color:#111;">
              Here's what you owe, {member_name} 🍜
            </h1>
            <p style="margin:0 0 20px;font-size:14px;color:#666;">{event_date}</p>

            <table width="100%" cellpadding="0" cellspacing="0"
                   style="border-collapse:collapse;border:1px solid #f0f0f0;
                          border-radius:8px;overflow:hidden;">
              <thead>
                <tr style="background:#f9f9fb;">
                  <th style="padding:10px 12px;font-size:13px;color:#888;
                             text-align:left;font-weight:600;">Item</th>
                  <th style="padding:10px 12px;font-size:13px;color:#888;
                             text-align:right;font-weight:600;">Amount</th>
                </tr>
              </thead>
              <tbody>
                {item_rows}
                <tr>
                  <td style="padding:8px 12px;font-size:14px;color:#333;
                             border-bottom:1px solid #f0f0f0;">Tax (your share)</td>
                  <td style="padding:8px 12px;font-size:14px;color:#333;text-align:right;
                             border-bottom:1px solid #f0f0f0;">${tax_share:.2f}</td>
                </tr>
                <tr>
                  <td style="padding:8px 12px;font-size:14px;color:#333;
                             border-bottom:1px solid #f0f0f0;">Tip (your share)</td>
                  <td style="padding:8px 12px;font-size:14px;color:#333;text-align:right;
                             border-bottom:1px solid #f0f0f0;">${tip_share:.2f}</td>
                </tr>
                <tr style="background:#fff8f9;">
                  <td style="padding:12px 12px;font-size:15px;font-weight:700;color:#f43f5e;">
                    Total
                  </td>
                  <td style="padding:12px 12px;font-size:15px;font-weight:700;
                             color:#f43f5e;text-align:right;">
                    ${total_owed:.2f}
                  </td>
                </tr>
              </tbody>
            </table>

            {_cta_button("&#10003; Mark as Paid", mark_paid_url)}
            {payment_note_block}

            <div style="margin-top:40px;padding-top:20px;border-top:1px solid #efefef;">
              <p style="margin:0;font-size:11px;color:#aaa;line-height:1.7;">
                Sent by clubPal &nbsp;·&nbsp; {event_name} &nbsp;·&nbsp; {event_date}
              </p>
            </div>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""

    return await _send(to_email, subject, html)


async def send_payer_summary_email(
    to_email: str,
    payer_name: str,
    event_name: str,
    event_date: str,
    total_paid: float,
    shares: list,
    event_url: str,
) -> bool:
    subject = f"You covered ${total_paid:.2f} at {event_name}"

    share_rows = "".join(
        f"""<tr>
          <td style="padding:8px 12px;font-size:14px;color:#333;
                     border-bottom:1px solid #f0f0f0;">
            {s.get('full_name', f"User {s['user_id']}")}
          </td>
          <td style="padding:8px 12px;font-size:14px;color:#333;text-align:right;
                     border-bottom:1px solid #f0f0f0;">
            ${s['total_owed']:.2f}
          </td>
          <td style="padding:8px 12px;font-size:14px;text-align:center;
                     border-bottom:1px solid #f0f0f0;">
            {"<span style='color:#22d3a0;font-weight:700;'>&#10003; Paid</span>"
             if s.get('paid')
             else "<span style='color:#f59e0b;font-weight:600;'>&#9203; Pending</span>"}
          </td>
        </tr>"""
        for s in shares
    )

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>{subject}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f6;
             font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0"
         style="background:#f4f4f6;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0"
             style="max-width:600px;width:100%;">
        <tr><td>{_coral_header(event_name)}</td></tr>
        <tr>
          <td style="background:#ffffff;padding:36px 32px 28px;
                     border-radius:0 0 12px 12px;">
            <h1 style="margin:0 0 8px;font-size:20px;font-weight:800;color:#111;">
              You covered ${total_paid:.2f} at {event_name}
            </h1>
            <p style="margin:0 0 20px;font-size:14px;color:#666;">{event_date}</p>

            <table width="100%" cellpadding="0" cellspacing="0"
                   style="border-collapse:collapse;border:1px solid #f0f0f0;
                          border-radius:8px;overflow:hidden;">
              <thead>
                <tr style="background:#f9f9fb;">
                  <th style="padding:10px 12px;font-size:13px;color:#888;
                             text-align:left;font-weight:600;">Member</th>
                  <th style="padding:10px 12px;font-size:13px;color:#888;
                             text-align:right;font-weight:600;">Amount</th>
                  <th style="padding:10px 12px;font-size:13px;color:#888;
                             text-align:center;font-weight:600;">Status</th>
                </tr>
              </thead>
              <tbody>
                {share_rows}
              </tbody>
            </table>

            {_cta_button("View in App", event_url)}

            <div style="margin-top:40px;padding-top:20px;border-top:1px solid #efefef;">
              <p style="margin:0;font-size:11px;color:#aaa;line-height:1.7;">
                Sent by clubPal &nbsp;·&nbsp; {event_name} &nbsp;·&nbsp; {event_date}
              </p>
            </div>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""

    return await _send(to_email, subject, html)
