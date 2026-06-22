import prisma from '../../core/utils/prisma.js';
import { tracerAction } from '../../services/audit.service.js';
import logger from '../../utils/logger.js';

export const listTemplates = async (req, res) => {
  try {
    const templates = await prisma.projectTemplate.findMany({
      where: { active: true },
      orderBy: { createdAt: 'desc' }
    });

    // Transform database templates to frontend format
    const formatted = templates.map(t => ({
      id: t.id,
      key: t.key,
      name: t.name,
      description: t.description,
      client: t.config?.client || 'GENERIC',
      defaultModules: t.modules || [],
      defaultUsers: t.config?.defaultUsers || [],
      defaultSettings: t.config?.defaultSettings || {},
      icon: t.config?.icon || 'Settings',
      category: t.config?.category || 'consulting'
    }));

    res.json(formatted);
  } catch (err) {
    logger.error('List templates error', err);
    res.status(500).json({ error: 'Server error listing templates' });
  }
};

export const getTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const t = await prisma.projectTemplate.findUnique({ where: { id } });
    if (!t) return res.status(404).json({ error: 'Template not found' });
    res.json(t);
  } catch (err) {
    logger.error('Get template error', err);
    res.status(500).json({ error: 'Server error fetching template' });
  }
};

export const createTemplate = async (req, res) => {
  try {
    const { key, name, description, config, modules, active } = req.body;
    const tpl = await prisma.projectTemplate.create({
      data: { key, name, description, config: config || {}, modules: modules || [], active: active ?? true },
    });

    await tracerAction({ userId: req.user.id, organizationId: req.user.organizationId, action: 'CREATE_PROJECT_TEMPLATE', resource: 'ProjectTemplate', resourceId: tpl.id, req });

    res.status(201).json(tpl);
  } catch (err) {
    logger.error('Create template error', err);
    res.status(500).json({ error: 'Server error creating template' });
  }
};

export const updateTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const updated = await prisma.projectTemplate.update({ where: { id }, data: updates });
    await tracerAction({ userId: req.user.id, organizationId: req.user.organizationId, action: 'UPDATE_PROJECT_TEMPLATE', resource: 'ProjectTemplate', resourceId: id, req });
    res.json(updated);
  } catch (err) {
    logger.error('Update template error', err);
    res.status(500).json({ error: 'Server error updating template' });
  }
};

export const deleteTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.projectTemplate.delete({ where: { id } });
    await tracerAction({ userId: req.user.id, organizationId: req.user.organizationId, action: 'DELETE_PROJECT_TEMPLATE', resource: 'ProjectTemplate', resourceId: id, req });
    res.json({ message: 'Deleted' });
  } catch (err) {
    logger.error('Delete template error', err);
    res.status(500).json({ error: 'Server error deleting template' });
  }
};
