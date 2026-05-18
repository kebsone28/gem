# Caching Strategy Implementation Guide

## Overview
Le service de caching réduit les requêtes DB en cachant:
- ✅ Permissions utilisateur (5 min TTL)
- ✅ Configuration projet (10 min TTL)
- ✅ Paramètres organisation (15 min TTL)

## Expected Performance Gains
- Permission checks: 50ms → 5ms (10x faster)
- Project lookups: 30ms → 2ms (15x faster)
- Overall dashboard load: 30-40% reduction

## Integration Points

### 1. Middleware - Permission Verification
```javascript
// middleware/verifierPermission.js
import { getCachedUserPermissions, cacheUserPermissions } from '../services/cacheService.js';

export const verifierPermission = (requiredPermission) => async (req, res, next) => {
  const { userId, organizationId } = req.user;
  
  // Try cache first
  let permissions = await getCachedUserPermissions(userId, organizationId);
  
  if (!permissions) {
    // Cache miss - query database
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { role: { include: { permissions: true } } },
    });
    
    permissions = extractPermissions(user);
    
    // Cache for future requests
    await cacheUserPermissions(userId, organizationId, permissions);
  }
  
  if (!permissions.includes(requiredPermission)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  next();
};
```

### 2. Project Controller - Config Lookup
```javascript
// modules/project/project.controller.js
import { getCachedProjectConfig, cacheProjectConfig, invalidateProjectConfig } from '../../services/cacheService.js';

export const getProjectConfig = async (projectId) => {
  // Try cache
  let config = await getCachedProjectConfig(projectId);
  
  if (!config) {
    // Cache miss
    config = await prisma.project.findUnique({
      where: { id: projectId },
      select: { config: true, status: true },
    });
    
    await cacheProjectConfig(projectId, config);
  }
  
  return config;
};

export const updateProject = async (req, res) => {
  // ... update logic ...
  
  // Invalidate cache after update
  await invalidateProjectConfig(projectId);
  
  res.json(updatedProject);
};
```

### 3. Organization Settings
```javascript
// modules/organization/organization.controller.js
import { getCachedOrgSettings, cacheOrgSettings, invalidateOrgSettings } from '../../services/cacheService.js';

export const getOrgSettings = async (organizationId) => {
  let settings = await getCachedOrgSettings(organizationId);
  
  if (!settings) {
    settings = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { config: true },
    });
    
    await cacheOrgSettings(organizationId, settings);
  }
  
  return settings;
};
```

## Cache Invalidation Strategy

### When to Invalidate:
1. **User permission change** → `invalidateUserPermissions(userId, orgId)`
2. **Project update** → `invalidateProjectConfig(projectId)`
3. **Org settings change** → `invalidateOrgSettings(orgId)`
4. **User role assignment** → `invalidateUserPermissions(userId, orgId)`

### Example:
```javascript
export const updateUserRole = async (req, res) => {
  const { userId, roleId } = req.body;
  
  // Update database
  await prisma.user.update({
    where: { id: userId },
    data: { roleId },
  });
  
  // Invalidate permission cache
  await invalidateUserPermissions(userId, req.user.organizationId);
  
  res.json({ success: true });
};
```

## Monitoring & Debugging

```javascript
// Track cache hit/miss rates (optional)
let cacheStats = { hits: 0, misses: 0 };

export const getCacheStats = () => cacheStats;

// In getCachedUserPermissions:
if (cached) {
  cacheStats.hits++;
  return JSON.parse(cached);
} else {
  cacheStats.misses++;
  return null;
}
```

## Failure Mode
- If Redis is down, cache returns `null` → triggers DB query
- App continues working, just without cache benefits
- No data loss or corruption possible
- Errors logged to logger.warn()

## Future Enhancements
- Add Redis cluster support for HA
- Implement cache warming on app startup
- Add Prometheus metrics for cache performance
- Implement distributed cache invalidation
