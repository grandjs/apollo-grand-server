// import express from 'express';
import { Request, Response } from 'grandjs';
import {
  GraphQLOptions,
  HttpQueryError,
  runHttpQuery,
  convertNodeHttpToRequest,
} from 'apollo-server-core';
import { ValueOrPromise } from 'apollo-server-types';

export interface GrandGraphQLOptionsFunction {
  (req: Request, res: Response): ValueOrPromise<GraphQLOptions>;
}

// Design principles:
// - there is just one way allowed: POST request with JSON body. Nothing else.
// - simple, fast and secure
//

export function graphqlGrand(
  options: GraphQLOptions | GrandGraphQLOptionsFunction,
) {
  if (!options) {
    throw new Error('Apollo Server requires options.');
  }

  if (arguments.length > 1) {
    throw new Error(
      `Apollo Server expects exactly one argument, got ${arguments.length}`,
    );
  }

  return (req:Request, res:Response, next:Function): void => {
    runHttpQuery([req, res], {
      method: req.method,
      options: options,
      query: req.method === 'POST' ? req.body : req.query,
      request: convertNodeHttpToRequest(req),
    }).then(
      ({ graphqlResponse, responseInit }) => {
        if (responseInit.headers) {
          for (const [name, value] of Object.entries(responseInit.headers)) {
            res.setHeader(name, value);
          }
        }
        if (typeof res.end === 'function') {
          res.end(graphqlResponse);
        } else {
          res.end(graphqlResponse);
        }
      },
      (error: HttpQueryError) => {
        if ('HttpQueryError' !== error.name) {
          return next(error);
        }

        if (error.headers) {
          for (const [name, value] of Object.entries(error.headers)) {
            res.setHeader(name, value);
          }
        }

        res.statusCode = error.statusCode;
        if (typeof res.end === 'function') {
          // Using `.end` is a best practice for Express, but we also just use
          // `.end` for compatibility with `connect`.
          res.end(error.message);
        } else {
          res.end(error.message);
        }
      },
    );
  };
}
