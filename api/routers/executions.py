import json
from typing import Optional
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from core.security import workspace_id
from routers.workflows import dispatch_action

router = APIRouter(tags=["Executions"])

class ExecutionApproveRequest(BaseModel):
    edited_message: Optional[str] = None


@router.get("/workflow-executions")
async def list_workflow_executions(request: Request, limit: int = 200, offset: int = 0):
    active_workspace = workspace_id(request)
    async with request.app.state.pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT e.id, e.workflow_id, w.name AS workflow_name, e.trigger_payload, e.decision_output,
                   e.status, e.source, e.executed_at, e.reviewed_at, e.reviewed_by,
                   (w.action_url IS NOT NULL) AS has_action
            FROM workflow_executions e
            JOIN workflows w ON w.id = e.workflow_id
            WHERE w.workspace_id = $1
            ORDER BY e.executed_at DESC, e.id DESC
            LIMIT $2 OFFSET $3;
        """, active_workspace, max(1, min(limit, 500)), max(0, offset))
        return [{
            "id": row["id"],
            "workflow_id": row["workflow_id"],
            "workflow_name": row["workflow_name"],
            "trigger_payload": json.loads(row["trigger_payload"]) if isinstance(row["trigger_payload"], str) else row["trigger_payload"],
            "decision_output": json.loads(row["decision_output"]) if isinstance(row["decision_output"], str) else row["decision_output"],
            "status": row["status"],
            "source": row["source"] or "inbound_webhook",
            "executed_at": row["executed_at"].isoformat() if row["executed_at"] else None,
            "reviewed_at": row["reviewed_at"].isoformat() if row["reviewed_at"] else None,
            "reviewed_by": row["reviewed_by"],
            "has_action": row["has_action"],
        } for row in rows]


@router.post("/workflows/executions/{execution_id}/approve")
async def approve_execution(execution_id: int, request: Request):
    user_claims = getattr(request.state, "user", None) or {}
    reviewer = user_claims.get("email") or user_claims.get("name") or "Authorized User"
    active_workspace = workspace_id(request)

    body = None
    try:
        raw_json = await request.json()
        if isinstance(raw_json, dict) and raw_json:
            body = ExecutionApproveRequest.model_validate(raw_json)
    except Exception:
        pass

    execution_id_val = execution_id
    try:
        async with request.app.state.pool.acquire() as conn:
            async with conn.transaction():
                ex = await conn.fetchrow("""
                    SELECT e.*, w.action_url, w.action_type, w.name AS workflow_name
                    FROM workflow_executions e JOIN workflows w ON e.workflow_id = w.id
                    WHERE e.id = $1 AND w.workspace_id = $2
                    FOR UPDATE OF e
                """, execution_id_val, active_workspace)
                if not ex:
                    raise HTTPException(status_code=404, detail="Execution not found")
                if ex["status"] not in {"pending_review", "pending_approval", "ai_evaluation_failed"}:
                    raise HTTPException(status_code=409, detail="This run has already been reviewed or is not waiting for review.")
                decision = json.loads(ex["decision_output"]) if isinstance(ex["decision_output"], str) else ex["decision_output"]
                trigger_payload = json.loads(ex["trigger_payload"]) if isinstance(ex["trigger_payload"], str) else ex["trigger_payload"]

                # Apply edited message if provided by reviewer
                if body and body.edited_message is not None:
                    if not isinstance(decision.get("action_payload"), dict):
                        decision["action_payload"] = {}
                    decision["action_payload"]["message"] = body.edited_message
                    await conn.execute("UPDATE workflow_executions SET decision_output = $1 WHERE id = $2", json.dumps(decision), execution_id_val)

                await conn.execute("UPDATE workflow_executions SET status = 'dispatching' WHERE id = $1", execution_id_val)
                action_url = ex["action_url"]
                workflow_id_val = ex["workflow_id"]
                workflow_name_val = ex["workflow_name"]
                action_type_val = ex["action_type"] or "email"

        dispatch_status = "approved"
        dispatch_error = None
        if action_url:
            try:
                await dispatch_action(action_url, workflow_id_val, workflow_name_val, decision, trigger_payload, execution_id_val, action_type=action_type_val)
            except Exception as error:
                print(f"[APPROVAL DISPATCH ERROR] execution={execution_id_val}: {error}")
                dispatch_status = "approved_dispatch_failed"
                dispatch_error = str(error)

        async with request.app.state.pool.acquire() as conn:
            if dispatch_error:
                if isinstance(decision, dict):
                    decision["error"] = dispatch_error
                await conn.execute("""
                    UPDATE workflow_executions 
                    SET status = $1, reviewed_at = NOW(), reviewed_by = $2, decision_output = $3::jsonb 
                    WHERE id = $4
                """, dispatch_status, reviewer, json.dumps(decision), execution_id_val)
            else:
                if isinstance(decision, dict) and "error" in decision:
                    decision.pop("error", None)
                await conn.execute("""
                    UPDATE workflow_executions 
                    SET status = $1, reviewed_at = NOW(), reviewed_by = $2, decision_output = $3::jsonb 
                    WHERE id = $4
                """, dispatch_status, reviewer, json.dumps(decision), execution_id_val)

        return {"status": dispatch_status, "execution_id": execution_id_val}
    except HTTPException:
        raise
    except Exception as unhandled_err:
        print(f"[APPROVAL FATAL ERROR] execution={execution_id_val}: {unhandled_err}")
        try:
            async with request.app.state.pool.acquire() as conn:
                await conn.execute("""
                    UPDATE workflow_executions 
                    SET status = 'approved_dispatch_failed', reviewed_at = NOW(), reviewed_by = $1 
                    WHERE id = $2
                """, reviewer, execution_id_val)
        except Exception:
            pass
        raise HTTPException(status_code=502, detail=f"Approval action dispatch failed: {str(unhandled_err)}")


@router.post("/workflows/executions/{execution_id}/reject")
async def reject_execution(execution_id: int, request: Request):
    user_claims = getattr(request.state, "user", None) or {}
    reviewer = user_claims.get("email") or user_claims.get("name") or "Authorized User"
    active_workspace = workspace_id(request)
    async with request.app.state.pool.acquire() as conn:
        res = await conn.execute("""
            UPDATE workflow_executions e
            SET status = 'rejected', reviewed_at = NOW(), reviewed_by = $1
            FROM workflows w
            WHERE e.workflow_id = w.id AND w.workspace_id = $2 AND e.id = $3
              AND e.status IN ('pending_review', 'pending_approval', 'ai_evaluation_failed');
        """, reviewer, active_workspace, execution_id)
        if res == "UPDATE 0":
            exists = await conn.fetchval("""
                SELECT 1 FROM workflow_executions e JOIN workflows w ON e.workflow_id = w.id
                WHERE e.id = $1 AND w.workspace_id = $2
            """, execution_id, active_workspace)
            if exists:
                raise HTTPException(status_code=409, detail="This run has already been reviewed or is not waiting for review.")
            raise HTTPException(status_code=404, detail="Execution not found")
        return {"status": "rejected", "execution_id": execution_id}


@router.post("/workflows/executions/{execution_id}/retry")
async def retry_execution_dispatch(execution_id: int, request: Request):
    active_workspace = workspace_id(request)
    async with request.app.state.pool.acquire() as conn:
        ex = await conn.fetchrow("""
            SELECT e.*, w.action_url, w.action_type, w.name AS workflow_name
            FROM workflow_executions e
            JOIN workflows w ON e.workflow_id = w.id
            WHERE e.id = $1 AND w.workspace_id = $2
        """, execution_id, active_workspace)
        if not ex:
            raise HTTPException(status_code=404, detail="Execution not found")
        if "failed" not in ex["status"] and ex["status"] != "dispatching":
            raise HTTPException(status_code=400, detail="Only failed or interrupted executions can be retried.")
        if not ex["action_url"]:
            raise HTTPException(status_code=400, detail="Workflow does not have an action URL configured.")
        
        decision = json.loads(ex["decision_output"]) if isinstance(ex["decision_output"], str) else ex["decision_output"]
        trigger_payload = json.loads(ex["trigger_payload"]) if isinstance(ex["trigger_payload"], str) else ex["trigger_payload"]
        action_type = ex["action_type"] or "email"

        try:
            await dispatch_action(
                ex["action_url"], ex["workflow_id"], ex["workflow_name"],
                decision, trigger_payload, execution_id, action_type=action_type
            )
            new_status = "approved" if ex["reviewed_at"] else "auto_executed"
            if isinstance(decision, dict) and "error" in decision:
                decision.pop("error", None)
            await conn.execute("UPDATE workflow_executions SET status = $1, decision_output = $2::jsonb WHERE id = $3", new_status, json.dumps(decision), execution_id)
            return {"status": new_status, "execution_id": execution_id, "message": "Action dispatched successfully."}
        except Exception as error:
            print(f"[RETRY DISPATCH ERROR] execution={execution_id}: {error}")
            new_status = "approved_dispatch_failed" if ex["reviewed_at"] else "automatic_dispatch_failed"
            if isinstance(decision, dict):
                decision["error"] = str(error)
            await conn.execute("UPDATE workflow_executions SET status = $1, decision_output = $2::jsonb WHERE id = $3", new_status, json.dumps(decision), execution_id)
            raise HTTPException(status_code=502, detail=f"Retry dispatch failed: {str(error)}")
