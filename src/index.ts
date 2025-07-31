import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import healthRoutes from './routes/health';
import apiRoutes from './routes/index';
import swaggerUi from 'swagger-ui-express';
import swaggerJSDoc from 'swagger-jsdoc';

// Load environment variables from .env file

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
  apis: ['./src/routes/v1/*.ts', './src/routes/health.ts'],
};
const swaggerSpec = swaggerJSDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Central health route
app.use('/api/health', healthRoutes);

// Use centralized API routes
app.use('/', apiRoutes);

// Catch-all 404 handler for API
app.use('/api/v1', (req, res) => {
  res.status(404).json({ error: 'Not Found', path: req.originalUrl });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  console.log(`Swagger docs available at http://localhost:${port}/api-docs`);
}); 