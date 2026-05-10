import { supabase } from "./supabase";

export type AuditAction = 
  | 'PARTNER_CREATED' 
  | 'PARTNER_UPDATED' 
  | 'STATUS_CHANGE' 
  | 'HARD_DELETE' 
  | 'LOGIN_SUCCESS' 
  | 'LOGIN_FAILURE';

export const logActivity = async (params: {
  actor_id: string;
  action: AuditAction;
  entity_type: string;
  entity_id: string;
  details?: any;
}) => {
  try {
    const { error } = await supabase.from("audit_logs").insert([{
      actor_id: params.actor_id,
      action: params.action,
      entity_type: params.entity_type,
      entity_id: params.entity_id,
      details: params.details || {},
    }]);
    if (error) console.error("[Audit] Log failed:", error.message);
  } catch (err) {
    console.error("[Audit] Fatal error:", err);
  }
};
