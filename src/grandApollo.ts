// import express from 'express';
import { Request, Response, APiError, APiResponseInterface, ErrorInfo, HttpStatusCode, APiType } from 'grandjs';
import {
  GraphQLOptions,
  HttpQueryError,
  runHttpQuery,
  convertNodeHttpToRequest,
  ApolloError
} from 'apollo-server-core';
import { ValueOrPromise } from 'apollo-server-types';
import { GraphQLError } from 'graphql';

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


export class GQLApiError extends Error{
  readonly type:string = 'GQLApiError';
  readonly textCode: string
  message:string
  defaultMessage?:string
  status: HttpStatusCode = HttpStatusCode.BAD_REQUEST
  validations?:any[]
  data?:any
  [key:string]:any
  constructor(info: ErrorInfo) {
    super(<string>info.message)
    this.textCode = info.textCode;
    this.message = typeof info.message === "object" ? info.message?.message : info.message;
    this.status = info.status as any || this.status;
    this.validations = info.validations;
    this.data = info.data;
      this.defaultMessage = info.defaultMessage || <string>info.message;;
    if(!this.message) {
        this.message = this.defaultMessage;
    }
}
}
export const assignErrorValues = (incomingError: GraphQLError, grandError:GQLApiError) => {
  Object.assign(incomingError.extensions.exception, { ...grandError, message: grandError.message });
  incomingError.message = grandError.message;
  delete incomingError.extensions.exception.type;
  return incomingError;
}
export const FormatError = (error: GraphQLError): any => {

  if (error.originalError instanceof GQLApiError) {
      error = assignErrorValues(error, error.originalError);
  } else {
      const formattedError = new GQLApiError({ message: error.message, textCode: error.extensions.code, status: <any>HttpStatusCode[error.extensions.code] || HttpStatusCode.INTERNAL_SERVER });
      error = assignErrorValues(error, formattedError);
  }
  return error;
}