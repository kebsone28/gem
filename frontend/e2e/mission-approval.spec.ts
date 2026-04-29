import { expect, type APIRequestContext, type Page, type Response, test } from '@playwright/test';

const requesterEmail = process.env.E2E_REQUESTER_EMAIL;
const requesterPassword = process.env.E2E_REQUESTER_PASSWORD;
const approverEmail = process.env.E2E_APPROVER_EMAIL;
const approverPassword = process.env.E2E_APPROVER_PASSWORD;
const cleanupEmail = process.env.E2E_ADMIN_EMAIL || approverEmail;
const cleanupPassword = process.env.E2E_ADMIN_PASSWORD || approverPassword;

type MissionResponse = {
  id: string;
  status?: string;
  title?: string;
  orderNumber?: string;
  data?: {
    isSubmitted?: boolean;
    isCertified?: boolean;
    purpose?: string;
  };
};

type WorkflowResponse = {
  missionId: string;
  title?: string;
  status?: string;
  overallStatus: 'draft' | 'pending' | 'approved' | 'rejected';
  orderNumber?: string;
  currentStep?: number;
  steps?: Array<{ role: string; status: string; comment?: string }>;
};

test.describe('Mission OM approval workflow', () => {
  test.skip(
    !requesterEmail || !requesterPassword || !approverEmail || !approverPassword,
    'Set E2E_REQUESTER_EMAIL, E2E_REQUESTER_PASSWORD, E2E_APPROVER_EMAIL and E2E_APPROVER_PASSWORD to run this workflow.'
  );

  test.setTimeout(180_000);
  const createdMissionIds: string[] = [];

  test.afterEach(async ({ request }) => {
    await cleanupE2EMissions(request, createdMissionIds.splice(0));
  });

  const apiLogin = async (
    request: APIRequestContext,
    email?: string,
    password?: string
  ): Promise<string | null> => {
    if (!email || !password) return null;
    const response = await request.post('/api/auth/login', {
      data: { email, password },
    });
    if (!response.ok()) return null;
    const body = await response.json();
    return body.accessToken || body.token || null;
  };

  const cleanupE2EMissions = async (request: APIRequestContext, missionIds: string[]) => {
    if (missionIds.length === 0) return;
    const token = await apiLogin(request, cleanupEmail, cleanupPassword);
    if (!token) return;

    for (const missionId of missionIds) {
      await request.delete(`/api/missions/${missionId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  };

  const loginAs = async (page: Page, email: string, password: string) => {
    await page.goto('/login');
    await page.locator('input[name="username"]').fill(email);
    await page.locator('input[name="password"]').fill(password);
    await page.getByRole('button', { name: /connecter|connexion|login/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
  };

  const resetSession = async (page: Page) => {
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.context().clearCookies();
  };

  const readJson = async <T,>(response: Response): Promise<T | null> => {
    try {
      return (await response.json()) as T;
    } catch {
      return null;
    }
  };

  const waitForSubmittedMission = async (
    page: Page,
    title: string,
    action: () => Promise<void>
  ): Promise<MissionResponse> => {
    const responses: Response[] = [];
    let notifyResponse: (() => void) | null = null;
    const waitForNextResponse = () =>
      new Promise<void>((resolve) => {
        notifyResponse = resolve;
      });
    const handler = (res: Response) => {
      const method = res.request().method();
      if (
        res.url().includes('/api/missions') &&
        !res.url().includes('/approval') &&
        ['POST', 'PATCH'].includes(method)
      ) {
        responses.push(res);
        notifyResponse?.();
        notifyResponse = null;
      }
    };

    page.on('response', handler);
    const deadline = Date.now() + 60_000;
    try {
      await action();

      while (Date.now() < deadline) {
        while (responses.length > 0) {
          const response = responses.shift()!;
          const body = await readJson<MissionResponse>(response);
          const matchesTitle = body?.title === title || body?.data?.purpose === title;
          if (
            response.ok() &&
            body?.id &&
            matchesTitle &&
            (body.status === 'soumise' || body.data?.isSubmitted === true)
          ) {
            return body;
          }
        }

        await Promise.race([
          waitForNextResponse(),
          page.waitForTimeout(Math.min(1_000, Math.max(100, deadline - Date.now()))),
        ]);
      }

      throw new Error('Mission submission was not confirmed by the backend.');
    } finally {
      page.off('response', handler);
    }
  };

  const getWorkflow = async (page: Page, missionId: string): Promise<WorkflowResponse> => {
    const workflow = await page.evaluate(async (id) => {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`/api/missions/${id}/approval-history`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error(`Workflow fetch failed: ${response.status}`);
      return response.json();
    }, missionId);

    return workflow as WorkflowResponse;
  };

  const postMissionDecision = async (
    page: Page,
    missionId: string,
    action: 'approve' | 'reject',
    body: Record<string, unknown>
  ) => {
    return await page.evaluate(
      async ({ id, decision, payload }) => {
        const token = localStorage.getItem('access_token');
        const response = await fetch(`/api/missions/${id}/${decision}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(payload),
        });
        return {
          status: response.status,
          ok: response.ok,
          body: await response.json().catch(() => null),
        };
      },
      { id: missionId, decision: action, payload: body }
    );
  };

  const expectPublicPdfDownload = async (page: Page, orderNumber: string) => {
    const result = await page.evaluate(async (identifier) => {
      const response = await fetch(`/api/missions/verify/${encodeURIComponent(identifier)}/document`);
      const contentType = response.headers.get('content-type') || '';
      const bytes = response.ok ? await response.arrayBuffer() : new ArrayBuffer(0);
      return {
        status: response.status,
        contentType,
        byteLength: bytes.byteLength,
      };
    }, orderNumber);

    expect(result.status).toBe(200);
    expect(result.contentType).toContain('application/pdf');
    expect(result.byteLength).toBeGreaterThan(500);
  };

  const createAndSubmitMission = async (page: Page, title: string): Promise<MissionResponse> => {
    await page.goto('/admin/mission');
    await expect(page.getByText(/ordre de mission/i)).toBeVisible({ timeout: 30_000 });

    const dialogHandler = async (dialog: import('@playwright/test').Dialog) => {
      if (/brouillon vide/i.test(dialog.message())) {
        await dialog.dismiss();
        return;
      }
      await dialog.accept();
    };
    page.on('dialog', dialogHandler);

    await page.locator('button[title="Nouveau"]').click();
    await expect(page.getByText(/brouillon/i).first()).toBeVisible({ timeout: 20_000 });

    try {
      await page.locator('#mission-region').fill('Dakar');
      await page.locator('#mission-start').fill('29/04/2026');
      await page.locator('#mission-end').fill('30/04/2026');
      await page.locator('#mission-purpose').fill(title);
      await page.getByRole('button', { name: /^ajouter$/i }).click();
      await page.locator('input[placeholder*="opératif"]').first().fill('Agent E2E');

      const submittedMission = await waitForSubmittedMission(page, title, async () => {
        await page.getByRole('button', { name: /soumettre/i }).click();
      });
      createdMissionIds.push(submittedMission.id);

      await expect(page.getByText(/attente|en attente|validation/i).first()).toBeVisible({
        timeout: 30_000,
      });

      const workflow = await getWorkflow(page, submittedMission.id);
      expect(workflow.overallStatus).toBe('pending');
      expect(['soumise', 'en_attente_validation']).toContain(workflow.status);

      return submittedMission;
    } finally {
      page.off('dialog', dialogHandler);
    }
  };

  const openApprovalMission = async (page: Page, title: string) => {
    await page.goto('/admin/approval');
    await expect(page.getByText(/cockpit direction générale/i)).toBeVisible({ timeout: 30_000 });
    await page.getByPlaceholder(/rechercher mission/i).fill(title);
    await expect(page.getByText(title).first()).toBeVisible({ timeout: 45_000 });
    await page.getByText(title).first().click();
  };

  const drawSignatureAndSave = async (page: Page) => {
    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible({ timeout: 20_000 });
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Signature canvas is not visible.');

    await page.mouse.move(box.x + 40, box.y + 40);
    await page.mouse.down();
    await page.mouse.move(box.x + 120, box.y + 80);
    await page.mouse.move(box.x + 220, box.y + 45);
    await page.mouse.up();

    await page.getByRole('button', { name: /valider.*apposer/i }).click();
  };

  test('full approval path: draft -> pending -> approved/certified', async ({ page }) => {
    const missionTitle = `E2E APPROVE ${Date.now()}`;

    await loginAs(page, requesterEmail!, requesterPassword!);
    const submittedMission = await createAndSubmitMission(page, missionTitle);

    const forbiddenApprove = await postMissionDecision(page, submittedMission.id, 'approve', {
      role: 'DIRECTEUR',
      comment: 'Tentative non autorisée E2E',
    });
    expect(forbiddenApprove.status).toBe(403);

    await resetSession(page);
    await loginAs(page, approverEmail!, approverPassword!);
    await openApprovalMission(page, missionTitle);

    const approveResponse = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/missions/${submittedMission.id}/approve`) &&
        response.request().method() === 'POST',
      { timeout: 45_000 }
    );

    await page.getByRole('button', { name: /valider la mission/i }).click();
    await drawSignatureAndSave(page);
    expect((await approveResponse).ok()).toBeTruthy();

    const approvedWorkflow = await getWorkflow(page, submittedMission.id);
    expect(approvedWorkflow.overallStatus).toBe('approved');
    expect(approvedWorkflow.status).toBe('approuvee');
    expect(approvedWorkflow.orderNumber).toBeTruthy();
    await expectPublicPdfDownload(page, approvedWorkflow.orderNumber!);

    const secondApprove = await postMissionDecision(page, submittedMission.id, 'approve', {
      role: 'DIRECTEUR',
      comment: 'Deuxième validation E2E',
    });
    expect([400, 409]).toContain(secondApprove.status);

    await page.goto('/admin/approval');
    await page.getByRole('button', { name: /voir les archives/i }).click();
    await page.getByPlaceholder(/rechercher mission/i).fill(missionTitle);
    await expect(page.getByText(missionTitle).first()).toBeVisible({ timeout: 45_000 });
  });

  test('full rejection path: draft -> pending -> rejected/resubmittable', async ({ page }) => {
    const missionTitle = `E2E REJECT ${Date.now()}`;
    const rejectionReason = `Rejet E2E ${Date.now()} : données à compléter avant validation.`;

    await loginAs(page, requesterEmail!, requesterPassword!);
    const submittedMission = await createAndSubmitMission(page, missionTitle);

    const forbiddenReject = await postMissionDecision(page, submittedMission.id, 'reject', {
      role: 'DIRECTEUR',
      reason: 'Tentative non autorisée E2E',
      category: 'AUTRE',
    });
    expect(forbiddenReject.status).toBe(403);

    await resetSession(page);
    await loginAs(page, approverEmail!, approverPassword!);
    await openApprovalMission(page, missionTitle);

    const rejectResponse = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/missions/${submittedMission.id}/reject`) &&
        response.request().method() === 'POST',
      { timeout: 45_000 }
    );

    await page.locator('textarea').fill(rejectionReason);
    await page.getByRole('button', { name: /^rejeter$/i }).click();
    await drawSignatureAndSave(page);
    expect((await rejectResponse).ok()).toBeTruthy();

    const rejectedWorkflow = await getWorkflow(page, submittedMission.id);
    expect(rejectedWorkflow.overallStatus).toBe('rejected');
    expect(rejectedWorkflow.status).toBe('rejetee');
    expect(rejectedWorkflow.steps?.some((step) => step.status === 'REJETE')).toBeTruthy();

    const secondReject = await postMissionDecision(page, submittedMission.id, 'reject', {
      role: 'DIRECTEUR',
      reason: 'Deuxième rejet E2E impossible',
      category: 'AUTRE',
    });
    expect(secondReject.status).toBe(409);

    await resetSession(page);
    await loginAs(page, requesterEmail!, requesterPassword!);
    const requesterWorkflow = await getWorkflow(page, submittedMission.id);
    expect(requesterWorkflow.overallStatus).toBe('rejected');
    expect(requesterWorkflow.status).toBe('rejetee');
  });
});
