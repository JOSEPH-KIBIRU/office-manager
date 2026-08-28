import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { requireUser, HttpError } from "@/lib/auth";
import { handle, ok, readJson } from "@/lib/api";
import { sendNewUserCredentials, notifyUser } from "@/lib/notify";
import { generateTempPassword } from "@/lib/passwords";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireUser(["admin"]);
    const { id: idStr } = await ctx.params;
    const id = idStr;

    const target = await cx().query(api.auth.getUserById, {
      secret: secret(),
      id: id as never,
      orgId: session.orgId as never,
    });
    if (!target) throw new HttpError(404, "User not found");

    const body = await readJson<{
      role?: string;
      active?: boolean;
      name?: string;
      phone?: string;
      email?: string;
      resetPassword?: boolean;
      leave_balance?: number;
      employee_number?: string;
      basic_salary?: number | null;
      statutory_number?: string;
      helb_deduction?: number | null;
    }>(req);

    if (target._id === session.id && (body.role || body.active === false)) {
      throw new HttpError(400, "You cannot change your own role or deactivate your own account");
    }

    let tempPassword: string | null = null;
    if (body.resetPassword) tempPassword = generateTempPassword();

    try {
      await cx().mutation(api.users.patchUser, {
        secret: secret(),
        orgId: session.orgId as never,
        id: id as never,
        role: body.role as never,
        active: target._id !== session.id ? body.active : undefined,
        name: body.name !== undefined ? String(body.name).trim() : undefined,
        phone: body.phone !== undefined ? String(body.phone).trim() : undefined,
        email: body.email !== undefined ? String(body.email) : undefined,
        leaveBalance: body.leave_balance !== undefined ? Number(body.leave_balance) : undefined,
        employeeNumber:
          body.employee_number !== undefined ? String(body.employee_number).trim() : undefined,
        basicSalary:
          body.basic_salary !== undefined && body.basic_salary !== null
            ? Number(body.basic_salary)
            : undefined,
        statutoryNumber:
          body.statutory_number !== undefined ? String(body.statutory_number).trim() : undefined,
        helbDeduction:
          body.helb_deduction !== undefined && body.helb_deduction !== null
            ? Number(body.helb_deduction)
            : undefined,
        newPasswordHash: tempPassword ? bcrypt.hashSync(tempPassword, 10) : undefined,
        mustChangePassword: body.resetPassword ? true : undefined,
      });
    } catch (e) {
      return mapConvexError(e);
    }

    if (tempPassword) {
      await sendNewUserCredentials(
        { id: target._id, name: target.name, email: target.email, phone: target.phone ?? null },
        tempPassword
      );
    }

    const updated = await cx().query(api.auth.getUserById, {
      secret: secret(),
      id: id as never,
      orgId: session.orgId as never,
    });

    if (body.role !== undefined && body.role !== target.role) {
      await notifyUser(
        session.orgId,
        target._id,
        "Your Role Has Been Updated",
        `<p>Your role on the Office Management System has been changed from <strong>${target.role}</strong> to <strong>${body.role}</strong>.</p>`,
        `Your office system role changed to ${body.role}. Log in to see your new access.`
      );
    }

    return ok({
      user: updated && {
        id: updated._id,
        name: updated.name,
        email: updated.email,
        phone: updated.phone ?? null,
        role: updated.role,
        leave_balance: updated.leaveBalance,
        employee_number: updated.employeeNumber ?? null,
        basic_salary: updated.basicSalary ?? null,
        statutory_number: updated.statutoryNumber ?? null,
        helb_deduction: updated.helbDeduction ?? null,
        must_change_password: updated.mustChangePassword ? 1 : 0,
        active: updated.active ? 1 : 0,
        created_at: new Date(updated.createdAt).toISOString().replace("T", " ").slice(0, 19),
      },
      tempPassword,
    });
  });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireUser(["admin"]);
    const { id: idStr } = await ctx.params;
    if (idStr === session.id) throw new HttpError(400, "You cannot delete your own account");

    try {
      const result = await cx().mutation(api.users.removeUser, {
        secret: secret(),
        orgId: session.orgId as never,
        id: idStr as never,
      });
      return ok(result);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
