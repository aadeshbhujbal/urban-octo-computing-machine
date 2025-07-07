import express from 'express';
import dotenv from 'dotenv';
import healthRoutes from './routes/v1/health';
import jiraRoutes from './routes/v1/jira';
import piPlanningRoutes from './routes/v1/piPlanning';
import mergeRequestsRoutes from './routes/v1/mergeRequests';
import velocityRoutes from './routes/v1/velocity';
import orchestrationRoutes from './routes/v1/orchestration';
import swaggerUi from 'swagger-ui-express';
import swaggerJSDoc from 'swagger-jsdoc';

// Load environment variables from .env file
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Simple request logger middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// Swagger setup
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Node Microservice API',
      version: '1.0.0',
      description: 'API documentation for the Node.js microservice',
    },
    servers: [
      { url: 'http://localhost:' + port },
    ],
  },
  apis: ['./src/routes/v1/*.ts'],
};
const swaggerSpec = swaggerJSDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// API Versioning: Mount all v1 routes under /api/v1
app.use('/api/v1/health', healthRoutes);
app.use('/api/v1/jira', jiraRoutes);
app.use('/api/v1/pi-planning', piPlanningRoutes);
app.use('/api/v1/merge-requests', mergeRequestsRoutes);
app.use('/api/v1/velocity', velocityRoutes);
app.use('/api/v1/orchestration', orchestrationRoutes);

// TODO: Import and use other v1 feature routes here
// e.g. app.use('/api/v1/jira', jiraRoutes);

// Catch-all 404 handler for API
app.use('/api/v1', (req, res) => {
  res.status(404).json({ error: 'Not Found', path: req.originalUrl });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  console.log(`Swagger docs available at http://localhost:${port}/api-docs`);
}); 