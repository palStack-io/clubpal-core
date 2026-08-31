import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
from typing import Optional


def _base(subject: str, content: str, app_url: str) -> str:
    """Wrap content in the branded clubPal / palStack.io email shell."""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{subject}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
         style="background:#f4f4f6;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" role="presentation"
               style="max-width:600px;width:100%;">

          <!-- ── Header ── -->
          <tr>
            <td style="background:#0e0e12;border-radius:12px 12px 0 0;padding:22px 32px;">
              <table cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="width:32px;height:32px;border-radius:8px;vertical-align:middle;">
                    <img src="{app_url}/clubPal.png" alt="CP" width="32" height="32"
                         style="border-radius:8px;display:block;" />
                  </td>
                  <td style="padding-left:10px;font-size:19px;font-weight:900;color:#ffffff;
                              letter-spacing:-0.5px;">
                    club<span style="color:#fb7185;">Pal</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── Rose accent line ── -->
          <tr>
            <td style="height:3px;background:linear-gradient(90deg,#f43f5e,#fb7185,#fda4af);"></td>
          </tr>

          <!-- ── Body ── -->
          <tr>
            <td style="background:#ffffff;padding:36px 32px 28px;border-radius:0 0 12px 12px;">
              {content}

              <!-- Footer -->
              <div style="margin-top:40px;padding-top:20px;border-top:1px solid #efefef;">
                <p style="margin:0;font-size:11px;color:#aaa;line-height:1.7;">
                  You're receiving this because you have an account on clubPal.<br>
                  clubPal is a product of
                  <a href="https://palstack.io" style="color:#f43f5e;text-decoration:none;">palStack.io</a>
                  &nbsp;·&nbsp;
                  <a href="{app_url}/settings" style="color:#aaa;text-decoration:none;">Notification preferences</a>
                </p>
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def _btn(label: str, url: str, color: str = "#f43f5e") -> str:
    """Render a CTA button."""
    return f"""
<p style="text-align:center;margin:28px 0;">
  <a href="{url}"
     style="background:{color};color:#ffffff;padding:13px 32px;
            text-decoration:none;border-radius:8px;display:inline-block;
            font-size:14px;font-weight:700;letter-spacing:0.2px;">
    {label}
  </a>
</p>
<p style="text-align:center;font-size:12px;color:#bbb;margin-top:-16px;">
  Or copy this link: <a href="{url}" style="color:#f43f5e;word-break:break-all;">{url}</a>
</p>"""


def _h1(text: str) -> str:
    return f'<h1 style="margin:0 0 16px;font-size:22px;font-weight:800;color:#111;letter-spacing:-0.3px;">{text}</h1>'


def _p(text: str) -> str:
    return f'<p style="margin:0 0 14px;font-size:15px;color:#444;line-height:1.6;">{text}</p>'


def _note(text: str) -> str:
    return f'<p style="margin:18px 0 0;font-size:12px;color:#aaa;line-height:1.6;">{text}</p>'


class EmailService:
    """Transactional email service for clubPal — a palStack.io product."""

    def __init__(self):
        self.smtp_host     = os.getenv("SMTP_HOST", "smtp.gmail.com")
        self.smtp_port     = int(os.getenv("SMTP_PORT", "587"))
        self.smtp_user     = os.getenv("SMTP_USER")
        self.smtp_password = os.getenv("SMTP_PASSWORD")
        self.from_name     = os.getenv("FROM_NAME", "clubPal")
        self.from_email    = os.getenv("FROM_EMAIL") or self.smtp_user or "noreply@palstack.io"
        self.frontend_url  = os.getenv("FRONTEND_URL", "http://localhost:3000")
        self.app_url       = os.getenv("APP_URL") or self.frontend_url
        self.enabled       = bool(self.smtp_user and self.smtp_password)

    def _send(self, to_email: str, subject: str, html: str) -> bool:
        if not self.enabled:
            print(f"[EMAIL DISABLED – NOT SENT] To: {to_email} | Subject: {subject}")
            return False
        try:
            msg = MIMEMultipart("alternative")
            msg["From"]    = f"{self.from_name} <{self.from_email}>"
            msg["To"]      = to_email
            msg["Subject"] = subject
            msg.attach(MIMEText(html, "html"))

            if self.smtp_port == 465:
                with smtplib.SMTP_SSL(self.smtp_host, self.smtp_port) as server:
                    server.login(self.smtp_user, self.smtp_password)
                    server.send_message(msg)
            else:
                with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                    server.starttls()
                    server.login(self.smtp_user, self.smtp_password)
                    server.send_message(msg)

            print(f"[EMAIL SENT] To: {to_email} | Subject: {subject}")
            return True
        except Exception as e:
            print(f"[EMAIL FAILED] To: {to_email} | {e}")
            return False

    # ── Auth emails ──────────────────────────────────────────────────────────

    def send_verification(self, to_email: str, username: str, token: str) -> bool:
        url = f"{self.app_url}/verify-email/{token}"
        content = (
            _h1("Confirm your email address")
            + _p(f"Hey <strong>{username}</strong>, welcome to clubPal!")
            + _p("Just one quick step — click below to verify your email and activate your account.")
            + _btn("Verify Email Address", url, "#f43f5e")
            + _note("Link expires in <strong>24 hours</strong>. If you didn't sign up, you can safely ignore this email.")
        )
        return self._send(to_email, "Confirm your clubPal email", _base("Confirm your email", content, self.app_url))

    def send_password_reset(self, to_email: str, username: str, token: str) -> bool:
        url = f"{self.app_url}/reset-password/{token}"
        content = (
            _h1("Reset your password")
            + _p(f"Hi <strong>{username}</strong>,")
            + _p("We received a request to reset your clubPal password. Click the button below to choose a new one.")
            + _btn("Reset Password", url, "#f43f5e")
            + _note("This link expires in <strong>1 hour</strong>. If you didn't request a reset, no action is needed — your password is unchanged.")
        )
        return self._send(to_email, "Reset your clubPal password", _base("Reset your password", content, self.app_url))

    # ── Invite emails ─────────────────────────────────────────────────────────

    def send_invite(self, to_email: str, group_name: str, invited_by_name: str,
                    invite_token: str, user_exists: bool) -> bool:
        url = f"{self.app_url}/invite/{invite_token}"

        if user_exists:
            subject = f"{invited_by_name} invited you to {group_name}"
            content = (
                _h1(f"You're invited to join <em style='color:#f43f5e;'>{group_name}</em>")
                + _p(f"<strong>{invited_by_name}</strong> has invited you to join their group on clubPal.")
                + _btn("Accept Invitation", url, "#f43f5e")
                + _note("Invitation expires in <strong>7 days</strong>.")
            )
        else:
            subject = f"Join {group_name} on clubPal"
            content = (
                _h1(f"You've been invited to clubPal!")
                + _p(f"<strong>{invited_by_name}</strong> has invited you to join "
                     f"<strong>{group_name}</strong> on clubPal.")
                + _p("clubPal helps groups coordinate activities, manage turn rotations, "
                     "and keep everyone on the same page.")
                + _btn("Create Account &amp; Join", url, "#f43f5e")
                + _note("Invitation expires in <strong>7 days</strong>.")
            )

        return self._send(to_email, subject, _base(subject, content, self.app_url))

    # ── Notification emails ───────────────────────────────────────────────────

    def send_rotation_alert(self, to_email: str, username: str,
                            group_name: str, group_id: int) -> bool:
        """Send 'it's your turn to pick an activity' alert."""
        url = f"{self.app_url}/groups/{group_id}"
        subject = f"It's your turn in {group_name}!"
        content = (
            _h1("Your turn to pick! 🎯")
            + _p(f"Hey <strong>{username}</strong>,")
            + _p(f"The rotation in <strong>{group_name}</strong> has moved to you. "
                 "It's your turn to pick the next activity.")
            + _btn("Pick an Activity", url, "#f43f5e")
            + _note("You can change your notification preferences in your "
                    f'<a href="{self.app_url}/settings" style="color:#f43f5e;">account settings</a>.')
        )
        return self._send(to_email, subject, _base(subject, content, self.app_url))

    def send_event_created(self, to_email: str, username: str, event_title: str,
                           event_date: str, group_name: str,
                           creator_name: str, event_id: int, has_rsvp: bool = True) -> bool:
        """Notify group member that a new event has been scheduled."""
        url = f"{self.app_url}/events/{event_id}"
        if has_rsvp:
            subject = f"RSVP: {event_title} in {group_name}"
            heading = "Are you in? 📅"
            body_line = (f"<strong>{creator_name}</strong> just scheduled a new event in "
                         f"<strong>{group_name}</strong>. Let everyone know if you're coming!")
            btn_label = "RSVP Now"
        else:
            subject = f"New event: {event_title} in {group_name}"
            heading = "New event planned 📅"
            body_line = (f"<strong>{creator_name}</strong> just scheduled a new event in "
                         f"<strong>{group_name}</strong>.")
            btn_label = "View Event"
        content = (
            _h1(heading)
            + _p(f"Hey <strong>{username}</strong>,")
            + _p(body_line)
            + f"""
<div style="background:#f9f9fb;border-left:3px solid #f43f5e;border-radius:0 8px 8px 0;
            padding:14px 18px;margin:20px 0;">
  <p style="margin:0;font-size:14px;font-weight:700;color:#111;">{event_title}</p>
  <p style="margin:4px 0 0;font-size:13px;color:#666;">{event_date}</p>
  <p style="margin:4px 0 0;font-size:12px;color:#aaa;">{group_name}</p>
</div>"""
            + _btn(btn_label, url, "#f43f5e")
            + _note("You're receiving this because you're a member of "
                    f"<strong>{group_name}</strong>. Update preferences in "
                    f'<a href="{self.app_url}/settings" style="color:#f43f5e;">settings</a>.')
        )
        return self._send(to_email, subject, _base(subject, content, self.app_url))

    def send_recurring_event_created(self, to_email: str, username: str, event_title: str,
                                     event_date: str, group_name: str, event_id: int) -> bool:
        """Notify group member that a recurring event instance has been auto-scheduled."""
        url = f"{self.app_url}/events/{event_id}"
        subject = f"Recurring event scheduled: {event_title}"
        content = (
            _h1(f"🔁 Recurring event: {event_title}")
            + _p(f"Hey <strong>{username}</strong>,")
            + _p(f"A new occurrence of <strong>{event_title}</strong> has been automatically "
                 f"scheduled for <strong>{group_name}</strong>.")
            + f"""
<div style="background:#f9f9fb;border-left:3px solid #f43f5e;border-radius:0 8px 8px 0;
            padding:14px 18px;margin:20px 0;">
  <p style="margin:0;font-size:14px;font-weight:700;color:#111;">{event_title}</p>
  <p style="margin:4px 0 0;font-size:13px;color:#666;">{event_date}</p>
  <p style="margin:4px 0 0;font-size:12px;color:#aaa;">Recurring event &nbsp;·&nbsp; {group_name}</p>
</div>"""
            + _btn("View Event", url, "#f43f5e")
            + _note("You're receiving this because you're a member of "
                    f"<strong>{group_name}</strong>. You can update your notification preferences "
                    f'in <a href="{self.app_url}/settings" style="color:#f43f5e;">account settings</a>.')
        )
        return self._send(to_email, subject, _base(subject, content, self.app_url))

    def send_rsvp_deadline_reminder(self, to_email: str, username: str, event_title: str,
                                    event_date: str, group_name: str,
                                    deadline_str: str, event_id: int) -> bool:
        """Notify group member that the RSVP deadline is approaching."""
        url = f"{self.app_url}/events/{event_id}"
        subject = f"RSVP closes soon for {event_title}"
        content = (
            _h1("RSVP deadline approaching ⏰")
            + _p(f"Hey <strong>{username}</strong>,")
            + _p(f"The RSVP deadline for <strong>{event_title}</strong> in "
                 f"<strong>{group_name}</strong> is coming up.")
            + f"""
<div style="background:#f9f9fb;border-left:3px solid #f43f5e;border-radius:0 8px 8px 0;
            padding:14px 18px;margin:20px 0;">
  <p style="margin:0;font-size:14px;font-weight:700;color:#111;">{event_title}</p>
  <p style="margin:4px 0 0;font-size:13px;color:#666;">📅 {event_date}</p>
  <p style="margin:4px 0 0;font-size:12px;color:#f43f5e;font-weight:600;">⏰ RSVP by: {deadline_str}</p>
</div>"""
            + _btn("RSVP Now", url, "#f43f5e")
            + _note("You're receiving this because you're a member of "
                    f"<strong>{group_name}</strong>. Update preferences in "
                    f'<a href="{self.app_url}/settings" style="color:#f43f5e;">settings</a>.')
        )
        return self._send(to_email, subject, _base(subject, content, self.app_url))

    def send_rsvp_deadline_final_count(self, to_email: str, username: str, event_title: str,
                                       event_date: str, group_name: str,
                                       going: int, maybe: int, not_going: int,
                                       event_id: int) -> bool:
        """Notify event creator of final RSVP counts after the deadline has passed."""
        url = f"{self.app_url}/events/{event_id}"
        subject = f"Final RSVP count for {event_title}"
        content = (
            _h1("RSVP deadline passed — final counts 📊")
            + _p(f"Hey <strong>{username}</strong>,")
            + _p(f"The RSVP deadline for <strong>{event_title}</strong> in "
                 f"<strong>{group_name}</strong> has passed. Here's the final headcount:")
            + f"""
<div style="background:#f9f9fb;border-left:3px solid #f43f5e;border-radius:0 8px 8px 0;
            padding:14px 18px;margin:20px 0;">
  <p style="margin:0;font-size:14px;font-weight:700;color:#111;">{event_title}</p>
  <p style="margin:4px 0 0;font-size:13px;color:#666;">📅 {event_date}</p>
  <p style="margin:12px 0 0;font-size:13px;color:#111;">
    <span style="color:#22d3a0;font-weight:700;">✓ Going: {going}</span> &nbsp;·&nbsp;
    <span style="color:#f59e0b;font-weight:700;">? Maybe: {maybe}</span> &nbsp;·&nbsp;
    <span style="color:#f87171;font-weight:700;">✕ Not going: {not_going}</span>
  </p>
</div>"""
            + _btn("View Event", url, "#f43f5e")
            + _note("You're receiving this as the organiser of "
                    f"<strong>{event_title}</strong> in <strong>{group_name}</strong>.")
        )
        return self._send(to_email, subject, _base(subject, content, self.app_url))

    def send_poll_created(self, to_email: str, username: str, activity_name: str,
                         group_name: str, creator_name: str, group_id: int) -> bool:
        """Notify group member that a new poll is open for their vote."""
        url = f"{self.app_url}/groups/{group_id}"
        subject = f"🗳️ {creator_name} wants your vote in {group_name}"
        content = (
            _h1(f"New vote: {activity_name}")
            + _p(f"Hey <strong>{username}</strong>,")
            + _p(f"<strong>{creator_name}</strong> is thinking about <strong>{activity_name}</strong> "
                 f"for <strong>{group_name}</strong> and wants to know what you think.")
            + f"""
<div style="background:#f9f9fb;border-left:3px solid #f43f5e;border-radius:0 8px 8px 0;
            padding:14px 18px;margin:20px 0;">
  <p style="margin:0;font-size:14px;font-weight:700;color:#111;">{activity_name}</p>
  <p style="margin:8px 0 0;font-size:13px;color:#444;">Tap your reaction:</p>
  <p style="margin:8px 0 0;font-size:13px;color:#444;">
    🙌 I'm in! &nbsp;·&nbsp; ❤️ Done it, loved it &nbsp;·&nbsp; 👎 Done it, pass &nbsp;·&nbsp; 🚫 Can't make it
  </p>
</div>"""
            + _btn("Vote Now →", url, "#f43f5e")
            + _note(f"You're receiving this because you're a member of <strong>{group_name}</strong>. "
                    f'Update preferences in <a href="{self.app_url}/settings" style="color:#f43f5e;">settings</a>.')
        )
        return self._send(to_email, subject, _base(subject, content, self.app_url))

    def send_poll_result(self, to_email: str, username: str, activity_name: str,
                         group_name: str, winner_text: str, result_summary: str,
                         responded_count: int, total_count: int, group_id: int) -> bool:
        """Notify group member that a poll has closed with final results."""
        url = f"{self.app_url}/groups/{group_id}"
        subject = f"📊 Poll result: {activity_name}"
        content = (
            _h1(f"Poll closed: {activity_name}")
            + _p(f"Hey <strong>{username}</strong>,")
            + _p(f"The poll in <strong>{group_name}</strong> has closed. Here are the final results:")
            + f"""
<div style="background:#f9f9fb;border-left:3px solid #f43f5e;border-radius:0 8px 8px 0;
            padding:14px 18px;margin:20px 0;">
  <p style="margin:0;font-size:14px;font-weight:700;color:#111;">Winner: {winner_text}</p>
  <p style="margin:8px 0 0;font-size:13px;color:#444;">{result_summary}</p>
  <p style="margin:10px 0 0;font-size:12px;color:#777;">{responded_count} of {total_count} responded</p>
</div>"""
            + _btn("View Poll →", url, "#f43f5e")
            + _note(f"You're receiving this because you're a member of <strong>{group_name}</strong>.")
        )
        return self._send(to_email, subject, _base(subject, content, self.app_url))

    def send_quota_alert(self, to_email: str, api_name: str,
                         today_calls: int, daily_limit: int,
                         approve_url: str) -> bool:
        """Notify admin that an API quota has been exhausted and the API is now blocked."""
        subject = f"[clubPal] API quota reached — {api_name} is now blocked"
        content = (
            _h1("API quota reached ⚠️")
            + _p(f"The <strong>{api_name}</strong> API has hit its daily call limit and has been "
                 f"<strong style='color:#f43f5e;'>automatically blocked</strong> to prevent unexpected charges.")
            + f"""
<div style="background:#f9f9fb;border-left:3px solid #f43f5e;border-radius:0 8px 8px 0;
            padding:14px 18px;margin:20px 0;">
  <p style="margin:0;font-size:14px;color:#111;"><strong>API:</strong> {api_name}</p>
  <p style="margin:6px 0 0;font-size:14px;color:#111;"><strong>Calls today:</strong> {today_calls}</p>
  <p style="margin:6px 0 0;font-size:14px;color:#111;"><strong>Daily limit:</strong> {daily_limit}</p>
  <p style="margin:6px 0 0;font-size:13px;color:#f43f5e;font-weight:600;">
    Status: BLOCKED — new API calls will be skipped until you approve
  </p>
</div>"""
            + _p("To resume API calls, visit the admin panel to approve the block or increase the daily limit.")
            + _btn("Review &amp; Approve in Admin Panel", approve_url, "#f43f5e")
        )
        return self._send(to_email, subject, _base(subject, content, self.app_url))

    def send_event_cancelled(self, to_email: str, username: str, event_title: str,
                             event_date: str, group_name: str, group_id: int) -> bool:
        """Notify an attendee that an event they RSVPed to has been cancelled."""
        url = f"{self.app_url}/groups/{group_id}"
        subject = f"Cancelled: {event_title}"
        content = (
            _h1(f"❌ {event_title} has been cancelled")
            + _p(f"Hi <strong>{username}</strong>,")
            + _p(f"Unfortunately, <strong>{event_title}</strong> in "
                 f"<strong>{group_name}</strong> has been cancelled.")
            + (f"""
<div style="background:#fff5f7;border-left:3px solid #f43f5e;border-radius:0 8px 8px 0;
            padding:14px 18px;margin:20px 0;">
  <p style="margin:0;font-size:14px;font-weight:700;color:#111;">{event_title}</p>
  <p style="margin:4px 0 0;font-size:13px;color:#666;">{event_date}</p>
</div>""" if event_date else "")
            + _p(f"Stay tuned for future events in <strong>{group_name}</strong>.")
            + _btn("View Group", url, "#f43f5e")
        )
        return self._send(to_email, subject, _base(subject, content, self.app_url))

    def send_group_membership(self, to_email: str, username: str, group_name: str,
                               group_id: int, message: str) -> bool:
        """Generic membership email — added to group, approved, declined."""
        url = f"{self.app_url}/groups/{group_id}"
        subject = f"clubPal: {group_name}"
        content = (
            _h1(message)
            + _p(f"Hi <strong>{username}</strong>,")
            + _p(f"This update is about your membership in <strong>{group_name}</strong>.")
            + _btn("Open Group", url, "#f43f5e")
        )
        return self._send(to_email, subject, _base(subject, content, self.app_url))

    def send_event_reminder(self, to_email: str, username: str, event_title: str,
                            event_date: str, group_name: str,
                            hours_until: int, event_id: int) -> bool:
        """Send a reminder before an event."""
        url = f"{self.app_url}/events/{event_id}"
        when = f"{hours_until} hour{'s' if hours_until != 1 else ''}"
        subject = f"Reminder: {event_title} starts in {when}"
        content = (
            _h1(f"Coming up in {when} ⏰")
            + _p(f"Hey <strong>{username}</strong>,")
            + _p(f"Don't forget — <strong>{event_title}</strong> in "
                 f"<strong>{group_name}</strong> is coming up soon.")
            + f"""
<div style="background:#f9f9fb;border-left:3px solid #f43f5e;border-radius:0 8px 8px 0;
            padding:14px 18px;margin:20px 0;">
  <p style="margin:0;font-size:14px;font-weight:700;color:#111;">{event_title}</p>
  <p style="margin:4px 0 0;font-size:13px;color:#666;">{event_date}</p>
</div>"""
            + _btn("View Event", url, "#f43f5e")
        )
        return self._send(to_email, subject, _base(subject, content, self.app_url))

    def send_rsvp_nudge(self, to_email: str, username: str, event_title: str,
                        event_date: str, group_name: str,
                        creator_name: str, event_id: int) -> bool:
        """Notify a group member that the event creator is asking them to RSVP."""
        url = f"{self.app_url}/events/{event_id}"
        subject = f"{creator_name} wants to know — are you in for {event_title}?"
        content = (
            _h1("RSVP requested 📅")
            + _p(f"Hey <strong>{username}</strong>,")
            + _p(f"<strong>{creator_name}</strong> is asking if you're in for "
                 f"<strong>{event_title}</strong> in <strong>{group_name}</strong>.")
            + f"""
<div style="background:#f9f9fb;border-left:3px solid #f43f5e;border-radius:0 8px 8px 0;
            padding:14px 18px;margin:20px 0;">
  <p style="margin:0;font-size:14px;font-weight:700;color:#111;">{event_title}</p>
  <p style="margin:4px 0 0;font-size:13px;color:#666;">{event_date}</p>
  <p style="margin:4px 0 0;font-size:12px;color:#aaa;">{group_name}</p>
</div>"""
            + _btn("RSVP Now", url, "#f43f5e")
            + _note("You're receiving this because you're a member of "
                    f"<strong>{group_name}</strong>. Update preferences in "
                    f'<a href="{self.app_url}/settings" style="color:#f43f5e;">settings</a>.')
        )
        return self._send(to_email, subject, _base(subject, content, self.app_url))

    def send_reengagement(self, to_email: str, username: str) -> bool:
        """Re-engagement email for users who haven't visited in a while."""
        url = f"{self.app_url}/groups"
        subject = "We miss you — what's happening in your clubs?"
        content = (
            _h1("It's been a while! 👋")
            + _p(f"Hey <strong>{username}</strong>,")
            + _p("Your clubs might have new events, polls, or activity waiting for you. "
                 "Come check in and see what you've missed.")
            + _btn("Open clubPal", url, "#f43f5e")
            + _note(f'To stop receiving these emails, update your preferences in '
                    f'<a href="{self.app_url}/settings" style="color:#f43f5e;">account settings</a>.')
        )
        return self._send(to_email, subject, _base(subject, content, self.app_url))


# Singleton
email_service = EmailService()
