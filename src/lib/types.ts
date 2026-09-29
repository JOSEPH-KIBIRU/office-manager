export type Role = "admin" | "secretary" | "manager" | "employee" | "super_admin";

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Director / Admin",
  secretary: "Secretary",
  manager: "Manager",
  employee: "Employee",
  super_admin: "Platform Owner",
};

export interface ImpersonationMeta {
  originalId: string;
  originalOrgId: string;
  originalRole: Role;
  originalName: string;
  originalEmail: string;
  companyName: string;
}

export interface SessionPayload {
  id: string;
  orgId: string;
  name: string;
  email: string;
  role: Role;
  mustChangePassword: boolean;
  termsAgreedAt?: boolean;
  termsVersion?: string;
  impersonating?: ImpersonationMeta;
}

export interface UserRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  password_hash: string;
  role: Role;
  leave_balance: number;
  must_change_password: number;
  active: number;
  created_at: string;
}

export const LEAVE_TYPES = [
  "annual",
  "sick",
  "bereavement",
  "maternity",
  "paternity",
  "personal",
  "other",
] as const;

export type LeaveType = (typeof LEAVE_TYPES)[number];

export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  annual: "Annual",
  sick: "Sick",
  bereavement: "Bereavement",
  maternity: "Maternity",
  paternity: "Paternity",
  personal: "Personal",
  other: "Other",
};

export type LeaveStatus = "pending" | "approved" | "rejected";

export interface LeaveRow {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  days: number;
  leave_type: LeaveType;
  reason: string;
  status: LeaveStatus;
  approved_by: string | null;
  approved_at: string | null;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
  requester_name?: string;
  approver_name?: string | null;
}

export interface ProfileChangeRequestRow {
  id: string;
  user_id: string;
  field: "name" | "email";
  current_value: string | null;
  requested_value: string;
  status: "pending" | "approved" | "rejected";
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  requester_name?: string;
}

export type CarCategory = "repair" | "insurance" | "service";
export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface CarLogRow {
  id: string;
  vehicle_reg: string;
  category: CarCategory;
  description: string;
  vendor: string | null;
  amount: number;
  log_date: string;
  status: ApprovalStatus;
  requested_by: string;
  approved_by: string | null;
  approved_at: string | null;
  note: string | null;
  requisition_no: string | null;
  created_at: string;
  updated_at: string;
  requester_name?: string;
}

export interface PettyCashRow {
  id: string;
  requested_by: string;
  amount: number;
  purpose: string;
  date_needed: string;
  status: "pending" | "approved" | "rejected" | "paid";
  approved_by: string | null;
  approved_at: string | null;
  paid_at: string | null;
  note: string | null;
  requisition_no: string | null;
  created_at: string;
  updated_at: string;
  requester_name?: string;
}

export interface DepartmentMember {
  id: string;
  name: string;
  role: Role;
}

export interface DepartmentRow {
  id: string;
  name: string;
  createdAt: string;
  memberCount: number;
  members: DepartmentMember[];
}

export interface DepartmentEmployee {
  id: string;
  name: string;
  role: Role;
  departmentId: string | null;
}

export interface MeetingRow {
  id: string;
  title: string;
  agenda: string | null;
  location: string | null;
  scheduled_at: string;
  attendees: string;
  director_id: string | null;
  status: "scheduled" | "completed" | "cancelled";
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface MinuteRow {
  id: string;
  meeting_id: string | null;
  title: string;
  meeting_date: string | null;
  attendees: string | null;
  points: string;
  content: string;
  file_name: string | null;
  file_path: string | null;
  ai_generated: number;
  status: "draft" | "final";
  written_by: string;
  author_name?: string;
  created_at: string;
  updated_at: string;
}
