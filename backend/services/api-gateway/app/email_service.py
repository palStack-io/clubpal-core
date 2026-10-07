import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import html as _html
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


def _esc(value) -> str:
    """HTML-escape free text before it's interpolated into an email template.
    Group names, event titles, usernames etc. are set by users — without this,
    one user could inject markup/scripts into an email delivered to another
    user's inbox."""
    return _html.escape(str(value)) if value is not None else ""


def _clean(value) -> str:
    """Strip CR/LF from free text before it's interpolated into a Subject
    line, so a user-controlled field can't inject extra mail headers."""
    return str(value).replace("\r", "").replace("\n", "") if value is not None else ""


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
            + _p(f"Hey <strong>{_esc(username)}</strong>, welcome to clubPal!")
            + _p("Just one quick step — click below to verify your email and activate your account.")
            + _btn("Verify Email Address", url, "#f43f5e")
            + _note("Link expires in <strong>24 hours</strong>. If you didn't sign up, you can safely ignore this email.")
        )
        return self._send(to_email, "Confirm your clubPal email", _base("Confirm your email", content, self.app_url))

    def send_verification_reminder(self, to_email: str, username: str, token: str) -> bool:
        """Periodic nudge for accounts that still haven't verified — token is
        freshly minted by the caller since the original link expires in 24h."""
        url = f"{self.app_url}/verify-email/{token}"
        subject = "One quick step to finish your clubPal account"
        content = (
            _h1("One quick step left")
            + _p(f"Hey <strong>{_esc(username)}</strong>,")
            + _p("Confirm your email whenever you're ready and your clubPal account is all set. "
                 "It unlocks invites, notifications, and more.")
            + _btn("Verify Email Address", url, "#f43f5e")
            + _note("Link expires in <strong>24 hours</strong>. If you didn't sign up, you can safely ignore this email.")
        )
        return self._send(to_email, subject, _base(subject, content, self.app_url))

    def send_password_reset(self, to_email: str, username: str, token: str) -> bool:
        url = f"{self.app_url}/reset-password/{token}"
        content = (
            _h1("Reset your password")
            + _p(f"Hi <strong>{_esc(username)}</strong>,")
            + _p("We received a request to reset your clubPal password. Click the button below to choose a new one.")
            + _btn("Reset Password", url, "#f43f5e")
            + _note("This link expires in <strong>1 hour</strong>. If you didn't request a reset, no action is needed — your password is unchanged.")
        )
        return self._send(to_email, "Reset your clubPal password", _base("Reset your password", content, self.app_url))

    # ── Invite emails ─────────────────────────────────────────────────────────

    def send_invite(self, to_email: str, group_name: str, invited_by_name: str,
                    invite_token: str, user_exists: bool) -> bool:
        url = f"{self.app_url}/invite/{invite_token}"
        safe_group_name = _esc(group_name)
        safe_invited_by_name = _esc(invited_by_name)

        if user_exists:
            subject = f"{_clean(invited_by_name)} invited you to {_clean(group_name)}"
            content = (
                _h1(f"You're invited to join <em style='color:#f43f5e;'>{safe_group_name}</em>")
                + _p(f"<strong>{safe_invited_by_name}</strong> has invited you to join their group on clubPal.")
                + _btn("Accept Invitation", url, "#f43f5e")
                + _note("Invitation expires in <strong>7 days</strong>.")
            )
        else:
            subject = f"Join {_clean(group_name)} on clubPal"
            content = (
                _h1(f"You've been invited to clubPal!")
                + _p(f"<strong>{safe_invited_by_name}</strong> has invited you to join "
                     f"<strong>{safe_group_name}</strong> on clubPal.")
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
        subject = f"It's your turn in {_clean(group_name)}"
        content = (
            _h1("Your turn to pick")
            + _p(f"Hey <strong>{_esc(username)}</strong>,")
            + _p(f"The rotation in <strong>{_esc(group_name)}</strong> has moved to you. "
                 "The next meetup is yours to pick, whenever you're ready.")
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
        safe_event_title = _esc(event_title)
        safe_group_name = _esc(group_name)
        safe_creator_name = _esc(creator_name)
        if has_rsvp:
            subject = f"RSVP: {_clean(event_title)} in {_clean(group_name)}"
            heading = "Are you in?"
            body_line = (f"<strong>{safe_creator_name}</strong> just scheduled a new event in "
                         f"<strong>{safe_group_name}</strong>. Want in? Let them know whenever you're ready.")
            btn_label = "RSVP Now"
        else:
            subject = f"New event: {_clean(event_title)} in {_clean(group_name)}"
            heading = "New event planned"
            body_line = (f"<strong>{safe_creator_name}</strong> just scheduled a new event in "
                         f"<strong>{safe_group_name}</strong>.")
            btn_label = "View Event"
        content = (
            _h1(heading)
            + _p(f"Hey <strong>{_esc(username)}</strong>,")
            + _p(body_line)
            + f"""
<div style="background:#f9f9fb;border-left:3px solid #f43f5e;border-radius:0 8px 8px 0;
            padding:14px 18px;margin:20px 0;">
  <p style="margin:0;font-size:14px;font-weight:700;color:#111;">{safe_event_title}</p>
  <p style="margin:4px 0 0;font-size:13px;color:#666;">{_esc(event_date)}</p>
  <p style="margin:4px 0 0;font-size:12px;color:#aaa;">{safe_group_name}</p>
</div>"""
            + _btn(btn_label, url, "#f43f5e")
            + _note("You're receiving this because you're a member of "
                    f"<strong>{safe_group_name}</strong>. Update preferences in "
                    f'<a href="{self.app_url}/settings" style="color:#f43f5e;">settings</a>.')
        )
        return self._send(to_email, subject, _base(subject, content, self.app_url))

    def send_recurring_event_created(self, to_email: str, username: str, event_title: str,
                                     event_date: str, group_name: str, event_id: int) -> bool:
        """Notify group member that a recurring event instance has been auto-scheduled."""
        url = f"{self.app_url}/events/{event_id}"
        safe_event_title = _esc(event_title)
        safe_group_name = _esc(group_name)
        subject = f"Recurring event scheduled: {_clean(event_title)}"
        content = (
            _h1(f"Recurring event: {safe_event_title}")
            + _p(f"Hey <strong>{_esc(username)}</strong>,")
            + _p(f"A new occurrence of <strong>{safe_event_title}</strong> has been automatically "
                 f"scheduled for <strong>{safe_group_name}</strong>.")
            + f"""
<div style="background:#f9f9fb;border-left:3px solid #f43f5e;border-radius:0 8px 8px 0;
            padding:14px 18px;margin:20px 0;">
  <p style="margin:0;font-size:14px;font-weight:700;color:#111;">{safe_event_title}</p>
  <p style="margin:4px 0 0;font-size:13px;color:#666;">{_esc(event_date)}</p>
  <p style="margin:4px 0 0;font-size:12px;color:#aaa;">Recurring event &nbsp;·&nbsp; {safe_group_name}</p>
</div>"""
            + _btn("View Event", url, "#f43f5e")
            + _note("You're receiving this because you're a member of "
                    f"<strong>{safe_group_name}</strong>. You can update your notification preferences "
                    f'in <a href="{self.app_url}/settings" style="color:#f43f5e;">account settings</a>.')
        )
        return self._send(to_email, subject, _base(subject, content, self.app_url))

    def send_rsvp_deadline_reminder(self, to_email: str, username: str, event_title: str,
                                    event_date: str, group_name: str,
                                    deadline_str: str, event_id: int) -> bool:
        """Notify group member that the RSVP deadline is approaching."""
        url = f"{self.app_url}/events/{event_id}"
        safe_event_title = _esc(event_title)
        safe_group_name = _esc(group_name)
        subject = f"Last call for {_clean(event_title)}"
        deadline_line = ('<p style="margin:4px 0 0;font-size:12px;color:#f43f5e;font-weight:600;">Answers close ' + _esc(deadline_str) + '</p>') if deadline_str else ""
        content = (
            _h1("Last call")
            + _p(f"Hey <strong>{_esc(username)}</strong>,")
            + _p(f"Are you in for <strong>{safe_event_title}</strong> in "
                 f"<strong>{safe_group_name}</strong>? "
                 + (f"Answers close {_esc(deadline_str)}." if deadline_str else "It's coming up soon."))
            + f"""
<div style="background:#f9f9fb;border-left:3px solid #f43f5e;border-radius:0 8px 8px 0;
            padding:14px 18px;margin:20px 0;">
  <p style="margin:0;font-size:14px;font-weight:700;color:#111;">{safe_event_title}</p>
  <p style="margin:4px 0 0;font-size:13px;color:#666;">{_esc(event_date)}</p>
  {deadline_line}
</div>"""
            + _btn("RSVP Now", url, "#f43f5e")
            + _note("You're receiving this because you're a member of "
                    f"<strong>{safe_group_name}</strong>. Update preferences in "
                    f'<a href="{self.app_url}/settings" style="color:#f43f5e;">settings</a>.')
        )
        return self._send(to_email, subject, _base(subject, content, self.app_url))

    def send_rsvp_deadline_final_count(self, to_email: str, username: str, event_title: str,
                                       event_date: str, group_name: str,
                                       going: int, maybe: int, not_going: int,
                                       event_id: int) -> bool:
        """Notify event creator of final RSVP counts after the deadline has passed."""
        url = f"{self.app_url}/events/{event_id}"
        safe_event_title = _esc(event_title)
        safe_group_name = _esc(group_name)
        subject = f"Final RSVP count for {_clean(event_title)}"
        content = (
            _h1("RSVPs are in")
            + _p(f"Hey <strong>{_esc(username)}</strong>,")
            + _p(f"The RSVP deadline for <strong>{safe_event_title}</strong> in "
                 f"<strong>{safe_group_name}</strong> has passed. Here's the final headcount:")
            + f"""
<div style="background:#f9f9fb;border-left:3px solid #f43f5e;border-radius:0 8px 8px 0;
            padding:14px 18px;margin:20px 0;">
  <p style="margin:0;font-size:14px;font-weight:700;color:#111;">{safe_event_title}</p>
  <p style="margin:4px 0 0;font-size:13px;color:#666;">{_esc(event_date)}</p>
  <p style="margin:12px 0 0;font-size:13px;color:#111;">
    <span style="color:#22d3a0;font-weight:700;">Going: {going}</span> &nbsp;·&nbsp;
    <span style="color:#f59e0b;font-weight:700;">Maybe: {maybe}</span> &nbsp;·&nbsp;
    <span style="color:#f87171;font-weight:700;">Not going: {not_going}</span>
  </p>
</div>"""
            + _btn("View Event", url, "#f43f5e")
            + _note("You're receiving this as the organiser of "
                    f"<strong>{safe_event_title}</strong> in <strong>{safe_group_name}</strong>.")
        )
        return self._send(to_email, subject, _base(subject, content, self.app_url))

    def send_poll_created(self, to_email: str, username: str, activity_name: str,
                         group_name: str, creator_name: str, group_id: int) -> bool:
        """Notify group member that a new poll is open for their vote."""
        url = f"{self.app_url}/groups/{group_id}"
        safe_activity_name = _esc(activity_name)
        safe_group_name = _esc(group_name)
        safe_creator_name = _esc(creator_name)
        subject = f"{_clean(creator_name)} would love your vote in {_clean(group_name)}"
        content = (
            _h1(f"New vote: {safe_activity_name}")
            + _p(f"Hey <strong>{_esc(username)}</strong>,")
            + _p(f"<strong>{safe_creator_name}</strong> is thinking about <strong>{safe_activity_name}</strong> "
                 f"for <strong>{safe_group_name}</strong> and wants to know what you think.")
            + f"""
<div style="background:#f9f9fb;border-left:3px solid #f43f5e;border-radius:0 8px 8px 0;
            padding:14px 18px;margin:20px 0;">
  <p style="margin:0;font-size:14px;font-weight:700;color:#111;">{safe_activity_name}</p>
  <p style="margin:8px 0 0;font-size:13px;color:#444;">Tap your reaction:</p>
  <p style="margin:8px 0 0;font-size:13px;color:#444;">
    I'm in &nbsp;·&nbsp; Done it, loved it &nbsp;·&nbsp; Done it, pass &nbsp;·&nbsp; Can't make it
  </p>
</div>"""
            + _btn("Vote Now →", url, "#f43f5e")
            + _note(f"You're receiving this because you're a member of <strong>{safe_group_name}</strong>. "
                    f'Update preferences in <a href="{self.app_url}/settings" style="color:#f43f5e;">settings</a>.')
        )
        return self._send(to_email, subject, _base(subject, content, self.app_url))

    def send_poll_result(self, to_email: str, username: str, activity_name: str,
                         group_name: str, winner_text: str, result_summary: str,
                         responded_count: int, total_count: int, group_id: int) -> bool:
        """Notify group member that a poll has closed with final results."""
        url = f"{self.app_url}/groups/{group_id}"
        safe_activity_name = _esc(activity_name)
        safe_group_name = _esc(group_name)
        subject = f"Poll result: {_clean(activity_name)}"
        content = (
            _h1(f"Poll closed: {safe_activity_name}")
            + _p(f"Hey <strong>{_esc(username)}</strong>,")
            + _p(f"The poll in <strong>{safe_group_name}</strong> has closed. Here are the final results:")
            + f"""
<div style="background:#f9f9fb;border-left:3px solid #f43f5e;border-radius:0 8px 8px 0;
            padding:14px 18px;margin:20px 0;">
  <p style="margin:0;font-size:14px;font-weight:700;color:#111;">Winner: {_esc(winner_text)}</p>
  <p style="margin:8px 0 0;font-size:13px;color:#444;">{_esc(result_summary)}</p>
  <p style="margin:10px 0 0;font-size:12px;color:#777;">{responded_count} of {total_count} responded</p>
</div>"""
            + _btn("View Poll →", url, "#f43f5e")
            + _note(f"You're receiving this because you're a member of <strong>{safe_group_name}</strong>.")
        )
        return self._send(to_email, subject, _base(subject, content, self.app_url))

    def send_event_cancelled(self, to_email: str, username: str, event_title: str,
                             event_date: str, group_name: str, group_id: int) -> bool:
        """Notify an attendee that an event they RSVPed to has been cancelled."""
        url = f"{self.app_url}/groups/{group_id}"
        safe_event_title = _esc(event_title)
        safe_group_name = _esc(group_name)
        subject = f"Change of plans: {_clean(event_title)} is off"
        content = (
            _h1(f"Change of plans: {safe_event_title} is off")
            + _p(f"Hi <strong>{_esc(username)}</strong>,")
            + _p(f"<strong>{safe_event_title}</strong> in "
                 f"<strong>{safe_group_name}</strong> has been cancelled. Hopefully next time.")
            + (f"""
<div style="background:#fff5f7;border-left:3px solid #f43f5e;border-radius:0 8px 8px 0;
            padding:14px 18px;margin:20px 0;">
  <p style="margin:0;font-size:14px;font-weight:700;color:#111;">{safe_event_title}</p>
  <p style="margin:4px 0 0;font-size:13px;color:#666;">{_esc(event_date)}</p>
</div>""" if event_date else "")
            + _p(f"There will be more to come in <strong>{safe_group_name}</strong>.")
            + _btn("View Group", url, "#f43f5e")
        )
        return self._send(to_email, subject, _base(subject, content, self.app_url))

    def send_group_membership(self, to_email: str, username: str, group_name: str,
                               group_id: int, message: str) -> bool:
        """Generic membership email — added to group, approved, declined."""
        url = f"{self.app_url}/groups/{group_id}"
        safe_group_name = _esc(group_name)
        subject = _clean(message) or f"{_clean(group_name)} on clubPal"
        content = (
            _h1(_esc(message))
            + _p(f"Hi <strong>{_esc(username)}</strong>,")
            + _p(f"This update is about your membership in <strong>{safe_group_name}</strong>.")
            + _btn("Open Group", url, "#f43f5e")
        )
        return self._send(to_email, subject, _base(subject, content, self.app_url))

    def send_event_reminder(self, to_email: str, username: str, event_title: str,
                            event_date: str, group_name: str,
                            hours_until: int, event_id: int) -> bool:
        """Send a reminder before an event."""
        url = f"{self.app_url}/events/{event_id}"
        safe_event_title = _esc(event_title)
        when = f"{hours_until} hour{'s' if hours_until != 1 else ''}"
        subject = f"Reminder: {_clean(event_title)} starts in {when}"
        content = (
            _h1(f"Coming up in {when}")
            + _p(f"Hey <strong>{_esc(username)}</strong>,")
            + _p(f"Just a heads-up: <strong>{safe_event_title}</strong> in "
                 f"<strong>{_esc(group_name)}</strong> is coming up soon.")
            + f"""
<div style="background:#f9f9fb;border-left:3px solid #f43f5e;border-radius:0 8px 8px 0;
            padding:14px 18px;margin:20px 0;">
  <p style="margin:0;font-size:14px;font-weight:700;color:#111;">{safe_event_title}</p>
  <p style="margin:4px 0 0;font-size:13px;color:#666;">{_esc(event_date)}</p>
</div>"""
            + _btn("View Event", url, "#f43f5e")
        )
        return self._send(to_email, subject, _base(subject, content, self.app_url))

    def send_rsvp_nudge(self, to_email: str, username: str, event_title: str,
                        event_date: str, group_name: str,
                        creator_name: str, event_id: int) -> bool:
        """Notify a group member that the event creator is asking them to RSVP."""
        url = f"{self.app_url}/events/{event_id}"
        safe_event_title = _esc(event_title)
        safe_group_name = _esc(group_name)
        safe_creator_name = _esc(creator_name)
        subject = f"Help {_clean(creator_name)} out: are you in for {_clean(event_title)}?"
        content = (
            _h1(f"{safe_creator_name} is planning {safe_event_title}")
            + _p(f"Hey <strong>{_esc(username)}</strong>,")
            + _p(f"Running a friend group isn't easy. A quick answer makes it easier for "
                 f"<strong>{safe_creator_name}</strong>, even if it's a no.")
            + f"""
<div style="background:#f9f9fb;border-left:3px solid #f43f5e;border-radius:0 8px 8px 0;
            padding:14px 18px;margin:20px 0;">
  <p style="margin:0;font-size:14px;font-weight:700;color:#111;">{safe_event_title}</p>
  <p style="margin:4px 0 0;font-size:13px;color:#666;">{_esc(event_date)}</p>
  <p style="margin:4px 0 0;font-size:12px;color:#aaa;">{safe_group_name}</p>
</div>"""
            + _btn("RSVP Now", url, "#f43f5e")
            + _note("You're receiving this because you're a member of "
                    f"<strong>{safe_group_name}</strong>. Update preferences in "
                    f'<a href="{self.app_url}/settings" style="color:#f43f5e;">settings</a>.')
        )
        return self._send(to_email, subject, _base(subject, content, self.app_url))

    def send_reengagement(self, to_email: str, username: str) -> bool:
        """Re-engagement email for users who haven't visited in a while."""
        url = f"{self.app_url}/groups"
        subject = "It's been a while"
        content = (
            _h1("It's been a while")
            + _p(f"Hey <strong>{_esc(username)}</strong>,")
            + _p("Your groups are still here whenever you want them. "
                 "Open clubPal to see what your group is planning.")
            + _btn("Open clubPal", url, "#f43f5e")
            + _note(f'To stop receiving these emails, update your preferences in '
                    f'<a href="{self.app_url}/settings" style="color:#f43f5e;">account settings</a>.')
        )
        return self._send(to_email, subject, _base(subject, content, self.app_url))


# Singleton
email_service = EmailService()
