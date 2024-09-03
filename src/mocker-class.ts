import { respond, getQueryParams, getRequestData, wait, requestData } from './utils';
import type {
  ClientRequest,
  ServerResponse,
  AllowedTypes,
  ServerHeaders,
} from './types';

export class Mocker {
  clientRequest: ClientRequest;
  serverResponse: ServerResponse;
  params: Record<string, string>;

  constructor(request: ClientRequest, response: ServerResponse, params: Record<string, string>) {
    this.clientRequest = request;
    this.serverResponse = response;
    this.params = params;
  }

  getQueryParams() {
    return getQueryParams(this.clientRequest.url);
  }

  respond(status: number, body?: AllowedTypes, headers?: ServerHeaders) {
    return respond(this.serverResponse, status, body, headers);
  }

  getRequestData() {
    return getRequestData(this.clientRequest);
  }

  delay(delayTime?: number) {
    return wait(delayTime);
  }

  request(url: string) {
    return requestData(url);
  }
}
