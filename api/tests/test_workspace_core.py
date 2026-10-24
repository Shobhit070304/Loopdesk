import os
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

os.environ.setdefault("GEMINI_API_KEY", "unit-test-key")
os.environ.setdefault("AUTH_SECRET", "unit-test-session-secret-that-is-long-enough")
os.environ.setdefault("AUTH_GOOGLE_ID", "unit-test-client-id")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from main import (  # noqa: E402
    WorkflowCreateRequest,
    _cache_key,
    _execution_mode,
    _new_webhook_credentials,
    _validate_action_url_syntax,
    workspace_id,
)


def test_cache_keys_are_private_to_each_workspace():
    assert _cache_key("account-a", "Where is my order?") != _cache_key("account-b", "Where is my order?")
    assert _cache_key("account-a", "Where is my order?") == _cache_key("account-a", " Where is my order? ")


def test_workflow_mode_is_one_workflow_level_setting():
    base = {"name": "Returns", "system_prompt": "Check the return policy."}
    assert _execution_mode(WorkflowCreateRequest(**base)) == "manual"
    assert _execution_mode(WorkflowCreateRequest(**base, execution_mode="automatic")) == "automatic"
    assert _execution_mode(WorkflowCreateRequest(**base, require_approval=False)) == "automatic"
    assert _execution_mode(WorkflowCreateRequest(**base, require_approval=True)) == "manual"


def test_webhook_credentials_fit_existing_database_columns():
    token, secret = _new_webhook_credentials()
    assert token.startswith("wh_live_") and len(token) <= 64
    assert secret.startswith("whsec_") and len(secret) <= 64


def test_workspace_comes_from_signed_account_claims():
    request = SimpleNamespace(state=SimpleNamespace(user={"sub": "google-account", "workspace_id": "personal-workspace"}))
    assert workspace_id(request) == "personal-workspace"


def test_workspace_is_required_for_protected_operations():
    request = SimpleNamespace(state=SimpleNamespace(user={}))
    with pytest.raises(HTTPException) as error:
        workspace_id(request)
    assert error.value.status_code == 401


@pytest.mark.parametrize("url", ["http://127.0.0.1/hook", "https://localhost/hook", "https://10.1.2.3/hook", "https://service.internal/hook"])
def test_private_outbound_action_targets_are_rejected(url):
    with pytest.raises(HTTPException) as error:
        _validate_action_url_syntax(url)
    assert error.value.status_code == 422


def test_public_https_action_target_is_allowed():
    assert _validate_action_url_syntax("https://support.example.com/hooks/customer") == "https://support.example.com/hooks/customer"


def test_production_requires_https(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    with pytest.raises(HTTPException) as error:
        _validate_action_url_syntax("http://support.example.com/hooks/customer")
    assert error.value.status_code == 422
