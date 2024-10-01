# Mockerver

Simple and light weight Mock Server with Vite plugin for easy integration.

## How to start

1. Install

```shell
$ npm i mockerver
```

2. Initialize it in your Vite config (I keep essentials only):

```javascript
import { useMockServer } from 'mockerver';

const MOCKS = {}; // Routes goes here

export const config = defineConfig(() => {
  const port = 19195; // Preferably from env; no value means no server
  const mocks = useMockServer(MOCKS, { port });

  return {
    plugins: [mocks.plugin()],
    server: {
      proxy: mocks.getProxy(),
    },
  };
});
```

## Basic usage

Most simple routing config would look like this:

```javascript
import { MockRouter } from 'mockerver';

const MOCKS: MockRouter = {
  '/some/route'() {
    return { message: 'Hello, World!' };
  }
};
```

Now Mock Server is listening to route `/some/route` and replies with provided JSON.

## Router configuration structure

Router configuration is a plain object with type MockRouter as type helper.
Keys of the object are URLs to listen to, values are functions (Actions)
with three parameters. Context `this` can be used to access some utilities.
Returned value will be sent as response payload. Let's see an example.

```javascript
const MOCKS: MockRouter = {
  '/api/some/:id'(request, response, extra) {
    const { params } = extra;

    this.delay(delayMS);
    this.getQueryParams();
    this.getRequestData();
    this.respond(201, body, header);
    this.use(action);
    this.request(url);

    return { data: 'to send' };
  }
};
```

`request` and `response` are objects from `node:http` Server for direct access;

`extra.params` is object containing url parameters. For example above if route
`/api/some/11-22-33` is accessed `extra.params` would be
`{ id: '11-22-33' }`;

`this.delay` is *async* method to add delay (in milliseconds) before response.
Argument is optional and 500 by default;

`this.getQueryParams` returns object with all query (search) parameters
as an object. For url `/api/some/1?a=hello&b=world` result would be
`{ a: 'hello', b: 'world' }`;

`this.getRequestData` - is *async* method for obtaining request body. It's obtained as Buffer, so JSON.parse is required to work with Json structure;

`this.respond` is method to reply with different status codes and headers;

`this.use` is method to use Action from another router;

`this.request` is method for requesting data from somwhere else
(only GET is currently supported).

## General use cases

### Different mothods handling

Requested method can be obtained from first Action's argument - `request`

```javascript
const MOCKS: MockRouter = {
  '/some/route'(request) {
    switch (request.method) {
      case 'GET':
        return { hello: 'You sent GET' };
      case 'POST':
        return { hello: 'You sent POST' };
      case 'PUT':
      case 'PATCH':
        return { hello: 'You sent either PUT or PATCH' };
      default:
        return { hello: 'Huh??' }
    }
  }
};
```

### Promises or delayed responses

Mock Server also works with promises, so it is possible to make routes async.

Also mokerver provides method for delayed reply.

```javascript
const MOCKS: MockRouter = {
  async '/some/route'() {
    await this.delay(1000); // Wait 1 second before reply is sent

    return { message: 'How was your waiting?' };
  }
};
```

### Server errors (400)

Error can be sent simply by `throw`. In that case Mock server sends response with status code 400

```javascript
const MOCKS: MockRouter = {
  '/some/route'() {
    throw { error: 'Something went terribly wrong!' };
  }
};
```

If you need some other status code, see solution below.

### Empty response body

If empty string ('') or `null` are returned, it will be considered as empty body, and response is sent with status 204 (No Content).

```javascript
const MOCKS: MockRouter = {
  '/some/route'() {
    return '';
  }
};
```

## Request parameters

### URL params

Parameters from 
