import http from 'http';

export type ClientRequest = http.IncomingMessage;
export type ServerResponse = http.ServerResponse<ClientRequest>;

export type ServerArgs = [ClientRequest, ServerResponse];

export type AllowedTypes = string | object | Buffer | null | undefined;
export type MockAction = (
  request: ClientRequest,
  response: ServerResponse,
  extra: { params: Record<string, string> },
) => Promise<AllowedTypes> | AllowedTypes;
export type MockRouter = Record<string, MockAction>;

export type RouterExtended = {
  pattern: RegExp;
  params: string[];
  action: MockAction;
};

export type RouteAction = {
  action: MockAction;
  params: Record<string, string>;
  key: string;
};

export type MockServerParams = {
  port?: number;
};
