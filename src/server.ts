import http from 'http';
import { MockCache } from './mock-cache';
import type {
  ClientRequest,
  MockAction,
  MockRouter,
  MockServerParams,
  RouteAction,
  RouterExtended,
  ServerResponse,
} from './types';
import { respond } from './utils';

const SERVER_RESTART_DELAY = 200;

const log = (message: string) => console.log(`[MOCK] ${message}`);

export const useMockServer = (
  config: MockRouter,
  params: MockServerParams = {},
) => {
  const mockRegExpCache = new MockCache(config);

  const getRequestMockFunction = (
    request: ClientRequest,
    response: ServerResponse,
  ) => {
    const url = request.url;
    const mock = url ? mockRegExpCache.search(url) : null;

    if (mock) {
      try {
        const result = mock.action(request, response, { params: mock.params });

        return {
          mock,
          promise: result instanceof Promise ? result : Promise.resolve(result),
        };
      } catch (error) {
        return {
          mock,
          promise: Promise.reject(error),
        };
      }
    }

    return null;
  };

  const TerminationRequest = {
    reply(request: ClientRequest, response: ServerResponse) {
      if (request.method === 'HEAD' && request.headers['x-close'] === 'true') {
        response.writeHead(204, { 'x-close-result': 'ok' }).end();
        return true;
      }

      return false;
    },

    send(url: string) {
      return new Promise<void>((resolve, reject) => {
        http
          .request(url, {
            method: 'HEAD',
            headers: { 'x-close': 'true' },
          })
          .on('response', (response) => {
            if (response.headers['x-close-result'] === 'ok') {
              resolve();
            } else {
              reject(new Error('Trying to close not a mock server'));
            }
          })
          .on('error', (error) => {
            reject(error);
          })
          .end();
      });
    },
  };

  function processRequest(
    this: http.Server,
    request: ClientRequest,
    response: ServerResponse,
  ) {
    if (TerminationRequest.reply(request, response)) {
      log('Mock server is being closed');
      this.close();
      return;
    }

    const mocked = getRequestMockFunction(request, response);
    if (mocked) {
      mocked.promise
        .then((result) => {
          if (result instanceof Response) {
            // Do nothing;
            return;
          }

          if (!result) {
            return respond(response, 204);
          }

          respond(response, 200, result);
        })
        .catch((error) => {
          if (error instanceof Error) {
            log(`Error at route: ${mocked.mock.key}`);
            console.log(error);
            return;
          }

          respond(response, 400, error);
        });
    } else {
      respond(response, 404);
    }
  }

  const startServer = (port: number) => {
    return http
      .createServer(processRequest)
      .on('error', (error) => {
        if ('code' in error && error.code === 'EADDRINUSE') {
          TerminationRequest.send(`http://localhost:${port}`)
            .then(() => {
              setTimeout(() => startServer(port), SERVER_RESTART_DELAY);
            })
            .catch(() => {
              log(`Failed to start Mock server. Port ${port} is busy.`);
            });
        } else {
          throw error;
        }
      })
      .listen(port, () =>
        log(`Mock server is started on port ${port}`),
      );
  };

  const mockServerPlugin = () => ({
    name: 'start-mockerver',
    configureServer() {
      if (params.port) {
        startServer(params.port);
      }
    },
  });

  const getProxy = () => {
    if (params.port) {
      const config: Record<string, string> = {};
      mockRegExpCache.iterate((route) => {
        config[route.pattern.source] = `http://localhost:${params.port}`;
      });

      return config;
    }

    return undefined;
  };

  return {
    plugin: mockServerPlugin,
    getProxy,
  };
};
