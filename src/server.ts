import http from 'http';
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

const SEARCH_QUERY_RE = /\?.+$/;
const PARAM_RE = /:(\w+)/g;

const SERVER_RESTART_DELAY = 200;

export const useMockServer = (
  config: MockRouter,
  params: MockServerParams = {},
) => {
  const mockRegExpCache = {
    routes: {} as Record<string, RouterExtended>,

    push(key: string, action: MockAction): RouterExtended {
      const params: string[] = [];

      const pattern = key.replace(PARAM_RE, function (_, key) {
        params.push(key);

        return '([^\\/]+)';
      });

      this.routes[key] = {
        pattern: new RegExp(`^${pattern}([?]([\\[\\]\\w%=]+&?)+)?$`),
        params,
        action,
      };

      return this.routes[key];
    },

    get(key: string): RouterExtended | null {
      return this.routes[key] || null;
    },

    init(router: MockRouter) {
      Object.keys(router).forEach((key) => {
        this.push(key, router[key]);
      });

      return this;
    },

    iterate(callback: (route: RouterExtended) => void) {
      Object.keys(this.routes).forEach((key) => callback(this.routes[key]));
    },

    search(url: string): RouteAction | null {
      for (const key in this.routes) {
        const { pattern, params, action } = this.routes[key];
        const match = pattern.exec(url);

        if (match) {
          const paramsMapped = params.reduce<Record<string, string>>(
            (result, key, index) => {
              result[key] = match[index + 1];
              return result;
            },
            {},
          );

          return { action: action, params: paramsMapped, key };
        }
      }

      return null;
    },
  }.init(config);

  const getRequestMockFunction = (
    request: ClientRequest,
    response: ServerResponse,
  ) => {
    const url = request.url?.replace(SEARCH_QUERY_RE, '');
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
      console.log('Mock server is being closed');
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
            console.log('Error at route:', mocked.mock.key);
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
              console.log(`Failed to start Mock server. Port ${port} is busy.`);
            });
        } else {
          throw error;
        }
      })
      .listen(port, () =>
        console.log(`Mock server is started on port ${port}`),
      );
  };

  const mockServerPlugin = () => ({
    name: 'start-mock-server',
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
