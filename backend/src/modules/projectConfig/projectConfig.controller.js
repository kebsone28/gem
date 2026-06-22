import prisma from '../../core/utils/prisma.js';
import { tracerAction } from '../../services/audit.service.js';
import logger from '../../utils/logger.js';

// Get template configuration for a project
export const getProjectTemplate = async (req, res) => {
  try {
    const projectId = req.params.id;
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { templateKey: true, templateVersion: true }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (!project.templateKey) {
      return res.json({ template: null, message: 'Project has no template' });
    }

    const template = await prisma.projectTemplate.findUnique({
      where: { key: project.templateKey }
    });

    if (!template) {
      return res.status(404).json({ error: `Template '${project.templateKey}' not found` });
    }

    res.json({ template, templateVersion: project.templateVersion });
  } catch (err) {
    logger.error('Get template error', err);
    res.status(500).json({ error: 'Server error getting template' });
  }
};

export const listPages = async (req, res) => {
  try {
    const projectId = req.params.id;
    const pages = await prisma.projectPage.findMany({ where: { projectId }, orderBy: { order: 'asc' } });
    res.json({ pages });
  } catch (err) {
    logger.error('List pages error', err);
    res.status(500).json({ error: 'Server error listing pages' });
  }
};

export const createPage = async (req, res) => {
  try {
    const projectId = req.params.id;
    const { key, name, icon, route, enabled, order, config } = req.body;
    const page = await prisma.projectPage.create({ data: { projectId, key, name, icon, route, enabled: enabled ?? true, order: order || 0, config: config || {} } });
    await tracerAction({ userId: req.user.id, organizationId: req.user.organizationId, action: 'CREATE_PROJECT_PAGE', resource: 'ProjectPage', resourceId: page.id, req });
    res.status(201).json(page);
  } catch (err) {
    logger.error('Create page error', err);
    res.status(500).json({ error: 'Server error creating page' });
  }
};

export const updatePage = async (req, res) => {
  try {
    const { pageId } = req.params;
    const updates = req.body;
    const updated = await prisma.projectPage.update({ where: { id: pageId }, data: updates });
    await tracerAction({ userId: req.user.id, organizationId: req.user.organizationId, action: 'UPDATE_PROJECT_PAGE', resource: 'ProjectPage', resourceId: pageId, req });
    res.json(updated);
  } catch (err) {
    logger.error('Update page error', err);
    res.status(500).json({ error: 'Server error updating page' });
  }
};

export const deletePage = async (req, res) => {
  try {
    const { pageId } = req.params;
    await prisma.projectPage.delete({ where: { id: pageId } });
    await tracerAction({ userId: req.user.id, organizationId: req.user.organizationId, action: 'DELETE_PROJECT_PAGE', resource: 'ProjectPage', resourceId: pageId, req });
    res.json({ message: 'Deleted' });
  } catch (err) {
    logger.error('Delete page error', err);
    res.status(500).json({ error: 'Server error deleting page' });
  }
};

// Modules
export const listModules = async (req, res) => {
  try {
    const projectId = req.params.id;
    const modules = await prisma.projectModule.findMany({ where: { projectId } });
    res.json({ modules });
  } catch (err) {
    logger.error('List modules error', err);
    res.status(500).json({ error: 'Server error listing modules' });
  }
};

export const createModule = async (req, res) => {
  try {
    const projectId = req.params.id;
    const { key, name, enabled, config, fields } = req.body;
    const mod = await prisma.projectModule.create({ data: { projectId, key, name, enabled: enabled ?? true, config: config || {}, fields: fields || [] } });
    await tracerAction({ userId: req.user.id, organizationId: req.user.organizationId, action: 'CREATE_PROJECT_MODULE', resource: 'ProjectModule', resourceId: mod.id, req });
    res.status(201).json(mod);
  } catch (err) {
    logger.error('Create module error', err);
    res.status(500).json({ error: 'Server error creating module' });
  }
};

export const updateModule = async (req, res) => {
  try {
    const { moduleId } = req.params;
    const updates = req.body;
    const updated = await prisma.projectModule.update({ where: { id: moduleId }, data: updates });
    await tracerAction({ userId: req.user.id, organizationId: req.user.organizationId, action: 'UPDATE_PROJECT_MODULE', resource: 'ProjectModule', resourceId: moduleId, req });
    res.json(updated);
  } catch (err) {
    logger.error('Update module error', err);
    res.status(500).json({ error: 'Server error updating module' });
  }
};

export const deleteModule = async (req, res) => {
  try {
    const { moduleId } = req.params;
    await prisma.projectModule.delete({ where: { id: moduleId } });
    await tracerAction({ userId: req.user.id, organizationId: req.user.organizationId, action: 'DELETE_PROJECT_MODULE', resource: 'ProjectModule', resourceId: moduleId, req });
    res.json({ message: 'Deleted' });
  } catch (err) {
    logger.error('Delete module error', err);
    res.status(500).json({ error: 'Server error deleting module' });
  }
};
