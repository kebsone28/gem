import logger from '../../utils/logger.js';
import swaggerJsDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { config } from './config.js';

const swaggerOptions = {
  swaggerDefinition: {
    openapi: '3.0.0',
    info: {
      title: 'PROQUELEC Web API',
      version: '1.0.0',
      description: 'API SaaS Électrification Nationale',
      contact: {
        name: 'Équipe PROQUELEC',
      },
    },
    servers: [
      {
        url: `http://localhost:${config.port || 5005}`,
        description: 'Serveur de Développement',
      },
      {
        url: 'https://ged.proquelec.sn',
        description: 'Serveur de Production',
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./src/api/routes/*.js', './src/modules/**/*.routes.js', './src/modules/**/*.router.js'],
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);

export const setupSwagger = (app) => {
  // Option pour le mode dev ou prod
  if (config.env !== 'production' || process.env.ENABLE_SWAGGER_PROD === 'true') {
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs, {
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: "PROQUELEC API Docs",
    }));
    logger.info('📚 Swagger API Docs available at /api-docs');
  }
};
