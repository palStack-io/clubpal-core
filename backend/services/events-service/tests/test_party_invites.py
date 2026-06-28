import unittest
from unittest.mock import AsyncMock, patch
import os

from fastapi import HTTPException

os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost/test")

from app import party_invites


class _FakeResponse:
    def __init__(self, status_code=200, payload=None, text=""):
        self.status_code = status_code
        self._payload = payload or {}
        self.text = text

    def json(self):
        return self._payload


class _FakeAsyncClient:
    def __init__(self, counters):
        self.counters = counters

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def get(self, url, **kwargs):
        if "/internal/users/1/profile" in url:
            self.counters["user_1_profile"] += 1
            return _FakeResponse(200, {"id": 1, "email": "u1@example.com", "full_name": "User One"})
        if "/internal/users/2/profile" in url:
            self.counters["user_2_profile"] += 1
            return _FakeResponse(200, {"id": 2, "email": "", "full_name": "User Two"})
        if "/internal/users/email-profile" in url:
            email = (kwargs.get("params") or {}).get("email")
            self.counters[f"email_lookup:{email}"] = self.counters.get(f"email_lookup:{email}", 0) + 1
            return _FakeResponse(200, {})
        raise AssertionError(f"Unexpected GET {url}")

    async def post(self, url, **kwargs):
        if "/internal/notify/push" in url:
            return _FakeResponse(200, {"ok": True})
        if "/internal/notify/party-invite-email" in url:
            payload = kwargs.get("json") or {}
            email = payload.get("to_email")
            self.counters[f"email_send:{email}"] = self.counters.get(f"email_send:{email}", 0) + 1
            if email == "b@example.com":
                raise RuntimeError("smtp down")
            return _FakeResponse(200, {"ok": True})
        raise AssertionError(f"Unexpected POST {url}")


class PartyInviteRoutesTests(unittest.IsolatedAsyncioTestCase):
    async def test_share_to_group_requires_admin_or_owner_membership(self):
        with patch.object(party_invites, "get_party_invite_by_token", return_value={"id": 10, "host_user_id": 7, "event_id": 55}), \
             patch.object(party_invites, "_get_group_membership", AsyncMock(return_value={"user_id": 7, "role": "member"})):
            with self.assertRaises(HTTPException) as ctx:
                await party_invites.share_to_group("abc", party_invites.ShareToGroupRequest(group_id=99), user_id=7)

        self.assertEqual(ctx.exception.status_code, 403)
        self.assertIn("owners and admins", ctx.exception.detail)

    async def test_share_to_group_is_idempotent_when_already_shared(self):
        notify_mock = AsyncMock()
        with patch.object(party_invites, "get_party_invite_by_token", return_value={"id": 10, "host_user_id": 7, "event_id": 55}), \
             patch.object(party_invites, "_get_group_membership", AsyncMock(return_value={"user_id": 7, "role": "owner"})), \
             patch.object(party_invites, "add_group_to_invite", return_value=False), \
             patch.object(party_invites, "_notify_invite_to_group", notify_mock):
            result = await party_invites.share_to_group("abc", party_invites.ShareToGroupRequest(group_id=99), user_id=7)

        self.assertEqual(result, {"ok": True, "group_id": 99, "already_shared": True})
        notify_mock.assert_not_awaited()

    async def test_invite_users_returns_partial_success_and_dedupes_inputs(self):
        counters = {"user_1_profile": 0, "user_2_profile": 0}
        body = party_invites.InviteUsersRequest(
            user_ids=[1, 1, 2],
            emails=["a@example.com", "a@example.com", "b@example.com"],
        )

        with patch.object(party_invites, "get_party_invite_by_token", return_value={"id": 10, "host_user_id": 7, "event_id": 55, "accent_color": "#f43f5e"}), \
             patch.object(party_invites, "get_event", return_value={"id": 55, "title": "Launch Party", "scheduled_date": None, "location": "HQ"}), \
             patch.object(party_invites, "add_member_invite"), \
             patch.object(party_invites, "upsert_email_notification"), \
             patch.object(party_invites, "_add_pending_attendees"), \
             patch.object(party_invites, "httpx") as httpx_mock:
            httpx_mock.AsyncClient.side_effect = lambda *args, **kwargs: _FakeAsyncClient(counters)
            result = await party_invites.invite_users("abc", body, user_id=7)

        self.assertEqual(counters["user_1_profile"], 1)
        self.assertEqual(counters["user_2_profile"], 1)
        self.assertEqual(counters["email_lookup:a@example.com"], 1)
        self.assertEqual(counters["email_lookup:b@example.com"], 1)
        self.assertEqual(counters["email_send:a@example.com"], 1)
        self.assertEqual(counters["email_send:b@example.com"], 1)

        self.assertEqual(result["summary"]["attempted_users"], 2)
        self.assertEqual(result["summary"]["attempted_emails"], 2)
        self.assertEqual(result["summary"]["added"], 2)
        self.assertEqual(result["summary"]["failed"], 2)
        self.assertEqual(
            result["added"],
            [
                {"type": "user", "user_id": 1, "email": "u1@example.com"},
                {"type": "email", "email": "a@example.com", "user_id": None},
            ],
        )
        self.assertEqual(
            result["failed"],
            [
                {"type": "user", "user_id": 2, "error": "User has no email"},
                {"type": "email", "email": "b@example.com", "error": "Failed to send invite email"},
            ],
        )


if __name__ == "__main__":
    unittest.main()
