import 'reflect-metadata';
import { OpenAPIObject } from 'openapi3-ts';
import { IRoute } from './compile';
export declare function getSpec(routes: IRoute[]): OpenAPIObject;
/**
 * Return the content type of given route.
 */
export declare function getContentType(route: IRoute): string;
/**
 * Return the status code of given route.
 */
export declare function getStatusCode(route: IRoute): string;
