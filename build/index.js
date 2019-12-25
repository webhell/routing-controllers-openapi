"use strict";
function __export(m) {
    for (var p in m) if (!exports.hasOwnProperty(p)) exports[p] = m[p];
}
Object.defineProperty(exports, "__esModule", { value: true });
const _ = require("lodash");
require("reflect-metadata");
const routing_controllers_1 = require("routing-controllers");
const compile_1 = require("./compile");
const generate_1 = require("./generate");
__export(require("./decorators"));
__export(require("./compile"));
__export(require("./generate"));
function routingControllersToSpec(storage = routing_controllers_1.getMetadataArgsStorage(), compilerOptions = {}, routingControllerOptions = {}, additionalProperties = {}) {
    const generator = compile_1.getGenerator(compilerOptions);
    const schemas = compile_1.generatorToSchemasByStorage(generator, storage, compilerOptions);
    const routes = compile_1.parseRoutes(storage, routingControllerOptions);
    const spec = generate_1.getSpec(routes);
    const transSpec = compile_1.transParameters(spec, generator);
    return _.merge(transSpec, { components: { schemas } }, additionalProperties);
}
exports.routingControllersToSpec = routingControllersToSpec;
