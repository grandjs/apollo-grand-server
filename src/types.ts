import { ExecutionParams } from 'subscriptions-transport-ws';
import {
  ContextFunction,
  Context,
  Config
} from 'apollo-server-core';
import corsMiddleware from 'cors';
import { OptionsJson } from 'body-parser';
import { Constructable } from 'grandjs/lib/interfaces';
import { Router } from 'grandjs';

export interface GrandContext {
  req: Request;
  res: Response;
  connection?: ExecutionParams;
}

export interface ApolloServerGrandConfig extends Config {
  context?: ContextFunction<GrandContext, Context> | Context;
}
export interface GetMiddlewareOptions {
  path?: string;
  cors?: corsMiddleware.CorsOptions | corsMiddleware.CorsOptionsDelegate | boolean;
  bodyParserConfig?: OptionsJson | boolean;
  onHealthCheck?: (req: Request) => Promise<any>;
  disableHealthCheck?: boolean;
}

export interface ServerRegistration extends GetMiddlewareOptions {
  Router: Constructable<Router>
}