import http from 'http';

const DEFAULT_WAIT_DELAY = 500;

type Response = http.ServerResponse<http.IncomingMessage>;
type Headers = http.OutgoingHttpHeaders;

const QUERY_PARAMS_RE = /\?(.+)$/;

class Chunks {
  data: Buffer[] = [];
  length = 0;

  get = () => Buffer.concat(this.data, this.length);

  push(chunk: Buffer) {
    this.data.push(chunk);
    this.length += chunk.length;
  }
}

export const requestData = (url: string) => {
  return new Promise((resolve, reject) => {
    http
      .get(url, (response) => {
        const chunks = new Chunks();

        if (response?.statusCode && response.statusCode < 300) {
          response
            .on('data', (chunk) => chunks.push(chunk))
            .on('end', () => resolve(chunks.get()));
        } else {
          reject(response);
        }
      })
      .on('error', reject);
  });
};

export const getRequestData = (request: http.IncomingMessage) =>
  new Promise<Buffer>((resolve) => {
    const chunks = new Chunks();

    request
      .on('data', (chunk) => chunks.push(chunk))
      .on('end', () => resolve(chunks.get()));
  });

export function respond(
  response: Response,
  status: number,
  data?: string | Buffer | object | null,
  headers: Headers = {},
) {
  const contentType = response.getHeader('content-type');

  if (data instanceof Buffer) {
    if (!response.headersSent) {
      response.writeHead(status, {
        'content-type': contentType || 'text/plain',
        ...headers,
      });
    }
    response.end(data);
  } else {
    if (!response.headersSent) {
      response.writeHead(status, {
        'content-type': contentType || 'application/json; charset=utf-8',
        ...headers,
      });
    }
    const dataToSend = data instanceof Object ? JSON.stringify(data) : data;
    response.end(dataToSend || '');
  }

  return response;
}

export const getQueryParams = (url?: string) =>
  url?.match(QUERY_PARAMS_RE)?.[1]?.split('&')
    .reduce<Record<string, string>>((result, item) => {
      const [name, value] = item.split('=');
      result[name] = decodeURIComponent(value);
      return result;
    }, {}) || {};

export const wait = (delay = DEFAULT_WAIT_DELAY) =>
  new Promise((resolve) => setTimeout(resolve, delay));
