import "reflect-metadata";
import { OpenAPIObject } from 'openapi3-ts';
import { MetadataArgsStorage, RoutingControllersOptions } from "routing-controllers";
import { ICompilerOptions } from "./compile";
export * from './decorators';
export * from './compile';
export * from './generate';
export declare function routingControllersToSpec(storage?: MetadataArgsStorage, compilerOptions?: ICompilerOptions, routingControllerOptions?: RoutingControllersOptions, additionalProperties?: Partial<OpenAPIObject>): OpenAPIObject;
