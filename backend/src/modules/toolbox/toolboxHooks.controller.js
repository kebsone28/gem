import prisma from '../../core/utils/prisma.js';
import logger from '../../utils/logger.js';

export const listHooks = async (req, res) => {
  try {
    const { formKey } = req.query;
    const { organizationId } = req.user;
    const where = { organizationId };
    if (formKey) where.formKey = String(formKey);

    const hooks = await prisma.toolboxFormHook.findMany({ where, orderBy: { createdAt: 'desc' } });
    return res.json({ success: true, hooks });
  } catch (err) {
    logger.error('[TOOLBOX-HOOKS] list error:', err);
    return res.status(500).json({ success: false, message: 'Erreur chargement hooks' });
  }
};

export const listWebhookExecutions = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { hookId, formKey, success, limit = 50, offset = 0 } = req.query;

    const where = { organizationId };
    if (hookId) where.hookId = String(hookId);
    if (formKey) where.formKey = String(formKey);
    if (success !== undefined) where.success = success === 'true';

    const [executions, total] = await Promise.all([
      prisma.toolboxWebhookExecution.findMany({
        where,
        skip: Number(offset),
        take: Math.min(Number(limit), 100),
        orderBy: { timestamp: 'desc' },
        include: { hook: { select: { name: true, url: true } } },
      }),
      prisma.toolboxWebhookExecution.count({ where }),
    ]);

    return res.json({
      success: true,
      count: executions.length,
      total,
      offset: Number(offset),
      limit: Number(limit),
      executions,
    });
  } catch (err) {
    logger.error('[TOOLBOX-HOOKS] list executions error:', err);
    return res
      .status(500)
      .json({ success: false, message: 'Erreur chargement exécutions webhook' });
  }
};

export const createHook = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { formKey, name, url, method, headers } = req.body;
    if (!formKey || !name || !url) {
      return res.status(400).json({ success: false, message: 'formKey, name, url requis' });
    }

    const hook = await prisma.toolboxFormHook.create({
      data: {
        organizationId,
        formKey: String(formKey),
        name: String(name).trim(),
        url: String(url).trim(),
        method: String(method || 'POST').toUpperCase(),
        headers: headers || {},
      },
    });
    return res.status(201).json({ success: true, hook });
  } catch (err) {
    if (err.code === 'P2002') {
      return res
        .status(409)
        .json({ success: false, message: 'Ce webhook existe déjà pour ce formulaire' });
    }
    logger.error('[TOOLBOX-HOOKS] create error:', err);
    return res.status(500).json({ success: false, message: 'Erreur création hook' });
  }
};

export const updateHook = async (req, res) => {
  try {
    const { id } = req.params;
    const { organizationId } = req.user;
    const existing = await prisma.toolboxFormHook.findFirst({ where: { id, organizationId } });
    if (!existing) return res.status(404).json({ success: false, message: 'Hook introuvable' });

    const { name, url, method, headers, active } = req.body;
    const data = {};
    if (name !== undefined) data.name = String(name).trim();
    if (url !== undefined) data.url = String(url).trim();
    if (method !== undefined) data.method = String(method).toUpperCase();
    if (headers !== undefined) data.headers = headers;
    if (active !== undefined) data.active = Boolean(active);

    const hook = await prisma.toolboxFormHook.update({ where: { id }, data });
    return res.json({ success: true, hook });
  } catch (err) {
    logger.error('[TOOLBOX-HOOKS] update error:', err);
    return res.status(500).json({ success: false, message: 'Erreur modification hook' });
  }
};

export const deleteHook = async (req, res) => {
  try {
    const { id } = req.params;
    const { organizationId } = req.user;
    const existing = await prisma.toolboxFormHook.findFirst({ where: { id, organizationId } });
    if (!existing) return res.status(404).json({ success: false, message: 'Hook introuvable' });

    await prisma.toolboxFormHook.delete({ where: { id } });
    return res.json({ success: true });
  } catch (err) {
    logger.error('[TOOLBOX-HOOKS] delete error:', err);
    return res.status(500).json({ success: false, message: 'Erreur suppression hook' });
  }
};

export const testHook = async (req, res) => {
  try {
    const { id } = req.params;
    const { organizationId } = req.user;
    const hook = await prisma.toolboxFormHook.findFirst({ where: { id, organizationId } });
    if (!hook) return res.status(404).json({ success: false, message: 'Hook introuvable' });

    const testPayload = {
      test: true,
      message: 'Test depuis GED OS Toolbox',
      timestamp: new Date().toISOString(),
    };
    const response = await fetch(hook.url, {
      method: hook.method,
      headers: { 'Content-Type': 'application/json', ...(hook.headers || {}) },
      body: JSON.stringify(testPayload),
      signal: AbortSignal.timeout(10000),
    });

    await prisma.toolboxFormHook.update({
      where: { id },
      data: { lastTriggeredAt: new Date(), lastStatus: response.status },
    });

    const body = await response.text().catch(() => '');
    return res.json({ success: response.ok, status: response.status, body: body.slice(0, 500) });
  } catch (err) {
    const message = err.name === 'AbortError' ? 'Timeout (10s)' : err.message;
    await prisma.toolboxFormHook
      .update({
        where: { id: req.params.id },
        data: { lastTriggeredAt: new Date(), lastStatus: 0 },
      })
      .catch(() => {});
    return res.json({ success: false, status: 0, body: message });
  }
};
