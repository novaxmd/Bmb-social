import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Bmbtech API',
      version: '1.0.0',
      description: 'REST API for a Telegram-synced video/music downloading platform',
      contact: {
        name: 'Bmbtech',
        url: 'https://download.bmntech.site'
      }
    },
    servers: [
      {
        url: process.env.API_URL || 'http://localhost:3001',
        description: 'API Server'
      }
    ],
    tags: [
      { name: 'Downloads', description: 'Download operations' },
      { name: 'System', description: 'System status and statistics' }
    ],
    components: {
      schemas: {
        Download: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            url: { type: 'string' },
            platform: { type: 'string', enum: ['youtube', 'instagram', 'tiktok', 'twitter'] },
            type: { type: 'string', enum: ['video', 'audio'] },
            quality: { type: 'string' },
            status: { type: 'string', enum: ['pending', 'downloading', 'sending', 'done', 'error', 'cancelled'] },
            progress: { type: 'number' },
            fileSize: { type: 'number' },
            fileName: { type: 'string' },
            title: { type: 'string' },
            duration: { type: 'number' },
            chatId: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        }
      }
    }
  },
  apis: ['./src/routes/*.ts']
};

export const swaggerSpec = swaggerJsdoc(options);
