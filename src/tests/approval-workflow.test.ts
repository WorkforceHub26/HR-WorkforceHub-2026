import { describe, it, expect, vi, beforeEach } from 'vitest';

// Simulates the approval logic of the HR system
function computeApprovalState(reqData: any, currentRole: string, hasExecutiveColumn: boolean, deptInfo: any) {
  let updateFields: any = {};

  if (currentRole === 'leader') {
    updateFields.manager_status = 'approved';
    const hasManagerInDept = deptInfo.hasManager || Boolean(reqData.employees?.l2_approver_id);
    if (!hasManagerInDept) {
      updateFields.director_status = 'approved';
    }
  } else if (currentRole === 'manager') {
    updateFields.director_status = 'approved';
    if (reqData.manager_status !== 'approved') {
      updateFields.manager_status = 'approved';
    }
    if (hasExecutiveColumn) {
      const applicantRole = String(reqData.employees?.role || '').toLowerCase();
      const isApplicantLeaderOrManager = ['leader', 'manager'].includes(applicantRole);
      if (!isApplicantLeaderOrManager) {
        updateFields.executive_status = 'approved';
      }
    }
  } else if (currentRole === 'executive' || currentRole === 'director' || currentRole === 'owner') {
    if (reqData.manager_status !== 'approved') updateFields.manager_status = 'approved';
    if (reqData.director_status !== 'approved') updateFields.director_status = 'approved';
    if (hasExecutiveColumn) {
      updateFields.executive_status = 'approved';
    } else {
      updateFields.status = 'approved';
      updateFields.approved_at = new Date().toISOString();
    }
  } else {
    // HR / Admin final stage approval
    if (reqData.manager_status !== 'approved') updateFields.manager_status = 'approved';
    if (reqData.director_status !== 'approved') updateFields.director_status = 'approved';
    if (hasExecutiveColumn) updateFields.executive_status = 'approved';
    updateFields.status = 'approved';
    updateFields.approved_at = new Date().toISOString();
  }

  return updateFields;
}

describe('HR Approval Workflow State Transitions', () => {
  it('should transition to approved by manager (L1) and bypass L2 director if department lacks L2 manager', () => {
    const leaveRequest = {
      id: 'req-1',
      employee_id: 'emp-123',
      manager_status: 'pending',
      director_status: 'pending',
      employees: {
        department_id: 'dept-qa',
        l2_approver_id: null
      }
    };

    const deptInfo = { hasManager: false };
    const updates = computeApprovalState(leaveRequest, 'leader', false, deptInfo);

    expect(updates.manager_status).toBe('approved');
    expect(updates.director_status).toBe('approved'); // bypassed!
  });

  it('should transition to approved by manager (L1) but wait for L2 if department has manager', () => {
    const leaveRequest = {
      id: 'req-2',
      employee_id: 'emp-123',
      manager_status: 'pending',
      director_status: 'pending',
      employees: {
        department_id: 'dept-dev',
        l2_approver_id: 'manager-456'
      }
    };

    const deptInfo = { hasManager: true };
    const updates = computeApprovalState(leaveRequest, 'leader', false, deptInfo);

    expect(updates.manager_status).toBe('approved');
    expect(updates.director_status).toBeUndefined(); // remains pending!
  });

  it('should completely approve and mark status as approved during final HR approval, leaving already approved columns alone', () => {
    const leaveRequest = {
      id: 'req-3',
      employee_id: 'emp-123',
      manager_status: 'approved',
      director_status: 'approved',
      status: 'pending'
    };

    const updates = computeApprovalState(leaveRequest, 'hr', false, {});

    // They are already 'approved' in reqData, so they are not reset or duplicated in updates payload
    expect(updates.manager_status).toBeUndefined();
    expect(updates.director_status).toBeUndefined();
    expect(updates.status).toBe('approved');
    expect(updates.approved_at).toBeDefined();
  });
});
