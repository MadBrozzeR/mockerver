import http from 'http';
import type { AllowedTypes, ServerHeaders, ServerResponse } from './types';

const DEFAULT_WAIT_DELAY = 500;

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
  return new Promise<Buffer>((resolve, reject) => {
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
  response: ServerResponse,
  status: number,
  data?: AllowedTypes,
  headers: ServerHeaders = {},
) {
  const contentType = response.getHeader('content-type');

  if (data instanceof Buffer) {
    if (!response.headersSent) {
      response.writeHead(status, {
        'content-type': contentType || 'application/octet-stream',
        'content-length': data.length,
        ...headers,
      });
    }
    response.end(data);
  } else if (data instanceof Object) {
    const dataToSend = JSON.stringify(data);
    if (!response.headersSent) {
      response.writeHead(status, {
        'content-type': contentType || 'application/json; charset=utf-8',
        'content-length': Buffer.byteLength(dataToSend),
        ...headers,
      });
    }
    response.end(dataToSend);
  } else {
    const dataToSend = data || '';
    if (!response.headersSent) {
      response.writeHead(status, {
        'content-type': contentType || 'text/plain; charset=utf-8',
        'content-length': Buffer.byteLength(dataToSend),
        ...headers,
      });
    }
    response.end(dataToSend);
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
  new Promise<void>((resolve) => { setTimeout(resolve, delay) });
