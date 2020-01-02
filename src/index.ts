import * as _ from 'lodash';
import "reflect-metadata";
import { OpenAPIObject } from 'openapi3-ts';
import { MetadataArgsStorage, getMetadataArgsStorage, RoutingControllersOptions } from "routing-controllers";
import { ICompilerOptions, getGenerator, generatorToSchemasByStorage, parseRoutes, transParameters } from "./compile";
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
    const routes = parseRoutes(storage, routingControllerOptions, compilerOptions);
    const spec = getSpec(routes);
    const transSpec = transParameters(spec, generator);
    return _.merge(transSpec, { components: { schemas } }, additionalProperties)
}
