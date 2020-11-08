import { NextFunction, Request, Response } from 'express';

type AsyncRouteHandler = (fn: (req: Request, res: Response, next: NextFunction) => void) => Function;
