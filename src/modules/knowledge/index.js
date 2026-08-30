import Material from './material.model.js';
import MaterialChunk from './material-chunk.model.js';
import * as materialRepository from './material.repository.js';
import * as materialChunkRepository from './material-chunk.repository.js';
import { authenticate } from '../auth/index.js';
import { coursesService } from '../courses/index.js';
import { config } from '../../config/index.js';
import { embeddingProvider } from '../../ai/embeddings/index.js';
import { createTextExtractor } from './providers/text-extractor.js';
import { createKnowledgeIngestionService } from './knowledge-ingestion.service.js';
import { createKnowledgeIngestionController } from './knowledge-ingestion.controller.js';
import { createKnowledgeIngestionRouter } from './knowledge-ingestion.routes.js';
import { validateSchemas } from '../../shared/validation/validate.middleware.js';
import {
  createMaterialSchema,
  courseIdParamSchema,
  listMaterialsQuerySchema,
  materialIdParamSchema,
  listChunksQuerySchema,
} from './knowledge-ingestion.schema.js';

export { Material as materialModel, MaterialChunk as materialChunkModel };
export { materialRepository, materialChunkRepository };

// Composition root (manual DI): repositories + cross-module services + AI
// providers -> ingestion service -> controller -> router.
export const knowledgeIngestionService = createKnowledgeIngestionService({
  coursesService,
  materialRepository,
  materialChunkRepository,
  embeddingProvider,
  textExtractor: createTextExtractor(),
  chunkOptions: {
    maxChars: config.chunk.maxChars,
    overlapChars: config.chunk.overlapChars,
  },
});

const controller = createKnowledgeIngestionController({ knowledgeIngestionService });

export const knowledgeIngestionRouter = createKnowledgeIngestionRouter({
  controller,
  middlewares: { authenticate },
  validators: {
    courseIdParam: validateSchemas({ params: courseIdParamSchema }),
    createMaterial: validateSchemas({ body: createMaterialSchema }),
    materialIdParam: validateSchemas({ params: materialIdParamSchema }),
    listMaterialsQuery: validateSchemas({ query: listMaterialsQuerySchema }),
    listChunksQuery: validateSchemas({ query: listChunksQuerySchema }),
  },
});