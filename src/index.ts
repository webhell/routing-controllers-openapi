import * as _ from 'lodash';
import "reflect-metadata";
import { OpenAPIObject } from 'openapi3-ts';
import { MetadataArgsStorage, getMetadataArgsStorage, RoutingControllersOptions } from "routing-controllers";
import { ICompilerOptions, getGenerator, generatorToSchemasByStorage, parseRoutes, transParameters, transResponse } from "./compile";
import { getSpec } from './generate';
export * from './decorators';
export * from './compile';
export * from './generate';

export function routingControllersToSpec(
    storage: MetadataArgsStorage = getMetadataArgsStorage(),
    compilerOptions: ICompilerOptions = {},
    routingControllerOptions: RoutingControllersOptions = {},
    additionalProperties: Partial<OpenAPIObject> = {}
): OpenAPIObject {
    const generator = getGenerator(compilerOptions);
    const schemas = generatorToSchemasByStorage(generator, storage, compilerOptions);
    const routes = parseRoutes(storage, routingControllerOptions)
    const spec = getSpec(routes);
    let transSpec = transParameters(spec, generator);
    transSpec = transResponse(spec, compilerOptions);
    return _.merge(transSpec, { components: { schemas } }, additionalProperties)
}
