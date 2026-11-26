import pg from 'pg';
import Fastify, { FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { AppConfig, loadConfig } from './config/env.js';
import { buildMetaEnvelope } from './config/meta-envelope.js';
import {
  DaycareRepository,
  InMemoryDaycareRepository,
  PostgresDaycareRepository,
} from './db/daycare-repository.js';
import { registerMcpRoutes } from './mcp/mcp-server.js';
import { registerAuthAndReportsRoutes } from './routes/auth-and-reports-routes.js';
import { registerPublicRoutes } from './routes/public-routes.js';
import {
  AuthVerifiers,
  createProductionAuthVerifiers,
} from './security/external-verifiers.js';

export interface BuildServerOptions {
  config?: AppConfig;
  repository?: DaycareRepository;
  verifiers?: AuthVerifiers;
}

export async function buildServer(
  options: BuildServerOptions | AppConfig = {}
): Promise<FastifyInstance> {
  const isConfigOnly = 'port' in options && 'secretPepper' in options;
  const config: AppConfig = isConfigOnly
    ? (options as AppConfig)
    : (options as BuildServerOptions).config || loadConfig();

  let managedPools: pg.Pool[] = [];
  let repository: DaycareRepository;
  if (!isConfigOnly && (options as BuildServerOptions).repository) {
    repository = (options as BuildServerOptions).repository!;
  } else if (config.nodeEnv === 'test') {
    repository = new InMemoryDaycareRepository();
  } else {
    const roPool = new pg.Pool({ connectionString: config.databasePublicRoUrl });
    const writePool = new pg.Pool({
      connectionString: config.databaseBackendWriteUrl,
    });
    managedPools = [roPool, writePool];
    repository = new PostgresDaycareRepository(roPool, writePool);
  }

  const verifiers: AuthVerifiers =
    (!isConfigOnly && (options as BuildServerOptions).verifiers) ||
    createProductionAuthVerifiers({
      googleClientId: config.googleClientId,
      turnstileSecretKey: config.turnstileSecretKey,
      nodeEnv: config.nodeEnv,
    });

  const app = Fastify({
    logger: config.nodeEnv !== 'test',
    trustProxy: true,
  });

  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  await app.register(cookie);

  // 1. Health & Readiness Endpoint for hasadna-k8s probes
  app.get('/api/v1/health', async () => {
    return {
      status: 'ok',
      service: 'dear-child-backend',
      active_school_year: config.activeSchoolYear,
      meta: buildMetaEnvelope(),
    };
  });

  // 2. Public Read-Only REST API Endpoints (app_public_ro)
  await registerPublicRoutes(app, repository, config.activeSchoolYear);

  // 3. Zero-PII Auth, Blind Upsert, Blind Withdraw & Corrections Endpoints (app_backend_write)
  await registerAuthAndReportsRoutes(app, repository, config, verifiers);

  // 4. MCP Server Endpoints (/mcp — yaldi-hayakar-mcp, Read-Only app_public_ro)
  await registerMcpRoutes(app, repository, config.activeSchoolYear);

  // 5. Static Frontend Serving for unified container topology on hasadna-k8s (D-38)
  const staticDir =
    config.frontendStaticDir ||
    path.resolve(process.cwd(), '../frontend/dist');
  if (existsSync(staticDir)) {
    await app.register(fastifyStatic, {
      root: staticDir,
      prefix: '/',
    });

    app.setNotFoundHandler((request, reply) => {
      if (
        request.url.startsWith('/api/') ||
        request.url.startsWith('/mcp')
      ) {
        reply.status(404).send({
          error: 'NOT_FOUND',
          message_he: 'נקודת הקצה המבוקשת לא נמצאה.',
        });
        return;
      }
      reply.sendFile('index.html');
    });
  }

  if (managedPools.length > 0) {
    app.addHook('onClose', async () => {
      await Promise.all(managedPools.map((p) => p.end()));
    });
  }

  return app;
}

if (
  process.argv[1] &&
  (process.argv[1].endsWith('server.js') ||
    process.argv[1].endsWith('server.ts'))
) {
  const config = loadConfig();
  buildServer(config)
    .then((app) => app.listen({ port: config.port, host: config.host }))
    .catch((err) => {
      console.error('Failed to start Dear Child server:', err);
      process.exit(1);
    });
}
