import { Request, Response } from 'grandjs';
import corsMiddleware from 'cors';
import { json } from 'body-parser';
import {
  renderPlaygroundPage,
  RenderPageOptions as PlaygroundRenderPageOptions,
} from '@apollographql/graphql-playground-html';
import {
  GraphQLOptions,
  FileUploadOptions,
  ApolloServerBase,
  formatApolloErrors,
  processFileUploads,
} from 'apollo-server-core';

import accepts from 'accepts';
import typeis from 'type-is';
import { graphqlGrand } from './grandApollo';
export { GraphQLOptions, GraphQLExtension } from 'apollo-server-core';
import { GrandContext, ApolloServerGrandConfig, ServerRegistration, GetMiddlewareOptions } from './types';

const fileUploadMiddleware = (
  uploadsConfig: FileUploadOptions,
  server: ApolloServerBase,
) => (
  req: Request,
  res: Response,
  next: Function,
) => {
  // Note: we use typeis directly instead of via req.is for connect support.
  if (
    typeof processFileUploads === 'function' &&
    typeis(req, ['multipart/form-data'])
  ) {
    processFileUploads(req, res, uploadsConfig)
      .then(body => {
        req.body = body;
        next();
      })
      .catch(error => {
        if (error.status && error.expose) res.status(error.status);

        next(
          formatApolloErrors([error], {
            formatter: server.requestOptions.formatError,
            debug: server.requestOptions.debug,
          }),
        );
      });
  } else {
    next();
  }
};



export class ApolloServer extends ApolloServerBase {
  constructor(config: ApolloServerGrandConfig) {
    super(config);
  }

  // This translates the arguments from the middleware into graphQL options It
  // provides typings for the integration specific behavior, ideally this would
  // be propagated with a generic to the super class
  async createGraphQLServerOptions(
    req: Request,
    res: Response,
  ): Promise<GraphQLOptions> {
    return super.graphQLServerOptions({ req: Request, res:Response });
  }

  protected supportsSubscriptions(): boolean {
    return true;
  }

  protected supportsUploads(): boolean {
    return true;
  }

  public applyMiddleware({Router, ...rest }: ServerRegistration) {
    const basePath = '/graphql';
    const self = this;
    this.ensureStarting();
    let uploadsMiddleware;
    if (this.uploadsConfig && typeof processFileUploads === 'function') {
      uploadsMiddleware = fileUploadMiddleware(this.uploadsConfig, this);
    }
    class ApolloServerRouter extends Router {
      cors = {
        origin: '*',
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
        preflightContinue: false,
        optionsSuccessStatus: 204
      };
      base = basePath;
    }
    const router = new ApolloServerRouter({base: '/graphql'});
    // const middleWares = []
    router.use(`/.well-known/apollo/server-health`, (req: Request, res:Response) => {
      // Response follows https://tools.ietf.org/html/draft-inadarei-api-health-check-01
      res.type('application/health+json');

      if (rest.onHealthCheck) {
        rest.onHealthCheck(<any>req)
          .then(() => {
            res.json({ status: 'pass' });
          })
          .catch(() => {
            res.status(503).json({ status: 'fail' });
          });
      } else {
        res.json({ status: 'pass' });
      }
    })
    if (rest.cors === true) {
      router.use('/', <any>corsMiddleware());
    } else if (rest.cors !== false) {
      router.use('/', <any>corsMiddleware(rest.cors));
    }

    if (rest.bodyParserConfig === true) {
      router.use('/', <any>json());
    } else if (rest.bodyParserConfig !== false) {
      router.use('/', <any>json(rest.bodyParserConfig));
    }

    if (uploadsMiddleware) {
      router.use('/', uploadsMiddleware);
    }
    router.use('/', (req: Request, res: Response, next) => {
      req.method = req.method.toUpperCase();
      if (self.playgroundOptions && req.method === 'GET') {
        // perform more expensive content-type check only if necessary
        // XXX We could potentially move this logic into the GuiOptions lambda,
        // but I don't think it needs any overriding
        const accept = accepts(req);
        const types = accept.types() as string[];
        const prefersHTML =
          types.find(
            (x: string) => x === 'text/html' || x === 'application/json',
          ) === 'text/html';

        if (prefersHTML) {
          const playgroundRenderPageOptions: PlaygroundRenderPageOptions = {
            endpoint: req.originalUrl,
            subscriptionEndpoint: self.subscriptionsPath,
            ...self.playgroundOptions,
          };
          res.setHeader('Content-Type', 'text/html');
          const playground = renderPlaygroundPage(playgroundRenderPageOptions);
          res.write(playground);
          res.end();
          return;
        }
      }

      return graphqlGrand(() => self.createGraphQLServerOptions(req, res))(
        req,
        res,
        next,
      );
    })
    router.build();
    return router;
  }

}
