
import { getProjects } from './src/modules/project/project.controller.js';

const mockReq = {
  user: {
    id: 'test-user-id',
    email: 'test@example.com',
    role: 'ADMIN_PROQUELEC',
    organizationId: 'proquelec-org-id'
  }
};

const mockRes = {
  json: (data) => console.log('SUCCESS:', JSON.stringify(data, null, 2)),
  status: (code) => {
    console.log('STATUS:', code);
    return {
      json: (data) => console.log('ERROR:', JSON.stringify(data, null, 2))
    };
  }
};

console.log('Running mock getProjects...');
getProjects(mockReq, mockRes).catch(err => {
  console.error('CRASH:', err);
});
