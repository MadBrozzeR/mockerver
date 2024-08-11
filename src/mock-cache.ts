import type {
  MockAction,
  MockRouter,
  RouteAction,
  RouterExtended,
} from './types';

const PARAM_RE = /:(\w+)/g;

export class MockCache {
  routes = {} as Record<string, RouterExtended>;

  constructor(router: MockRouter) {
    this.init(router);
  }

  push(key: string, action: MockAction): RouterExtended {
    const params: string[] = [];

    const pattern = key.replace(PARAM_RE, function (_, key) {
      params.push(key);

      return '([^\\/?]+)';
    });

    this.routes[key] = {
      pattern: new RegExp(`^${pattern}(?:\\?.+)?$`),
      params,
      action,
    };

    return this.routes[key];
  }

  get(key: string): RouterExtended | null {
    return this.routes[key] || null;
  }

  init(router: MockRouter) {
    Object.keys(router).forEach((key) => {
      this.push(key, router[key]);
    });

    return this;
  }

  iterate(callback: (route: RouterExtended) => void) {
    Object.keys(this.routes).forEach((key) => callback(this.routes[key]));
  }

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
  }
};
