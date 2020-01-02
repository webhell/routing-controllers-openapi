"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const glob = require("glob");
const fs = require("fs");
const path = require("path");
const _ = require("lodash");
require("reflect-metadata");
const typescript_json_schema_1 = require("typescript-json-schema");
const decorators_1 = require("./decorators");
/**将routing-controllers元数据解析为IRoute对象数组 */
function parseRoutes(storage, options = {}, compilerOptions = {}) {
    const routes = storage.actions.map(action => ({
        action,
        controller: _.find(storage.controllers, { target: action.target }),
        options,
        params: _.sortBy(storage.filterParamsWithTargetAndMethod(action.target, action.method), 'index'),
        responseHandlers: storage.filterResponseHandlersWithTargetAndMethod(action.target, action.method)
    }));
    const { transResponseFun } = compilerOptions;
    if (transResponseFun) {
        storage.controllers.map(controller => {
            decorators_1.TransRespons(transResponseFun).apply(null, [controller.target]);
        });
    }
    return routes;
}
exports.parseRoutes = parseRoutes;
function getSchemaByType(type, param) {
    const refPointerPrefix = '#/components/schemas/';
    if (param && param.explicitType) {
        const reference = { $ref: refPointerPrefix + param.explicitType.name };
        if (_.isFunction(type) && type.name === 'Array') {
            return {
                type: 'array',
                items: reference
            };
        }
        return reference;
    }
    let schema = {};
    if (_.isArray(type)) {
        schema = {
            type: 'array',
            items: getSchemaByType(type[0])
        };
    }
    else if (_.isFunction(type)) {
        if (_.isString(type.prototype) || _.isSymbol(type.prototype)) {
            schema = { type: 'string' };
        }
        else if (_.isNumber(type.prototype)) {
            schema = { type: 'number' };
        }
        else if (_.isBoolean(type.prototype)) {
            schema = { type: 'boolean' };
        }
        else if (type.name === 'Array') {
            loggerNotSupport(`type Array not support`, param);
            schema = { type: 'array' };
        }
        else if (type.name === 'Object') {
            loggerNotSupport(`type Object not support`, param);
            schema = { type: 'object' };
        }
        else {
            schema = { $ref: refPointerPrefix + type.name };
        }
    }
    else if (_.isString(type) && type) {
        const JsType = ['string', 'number', 'boolean', 'null', 'any'];
        if (JsType.indexOf(type) > -1) {
            schema = { type };
        }
        else {
            schema = { $ref: refPointerPrefix + type };
        }
    }
    else {
        loggerNotSupport(`type Any not support`, param);
        schema = { type: 'any' };
    }
    return schema;
}
exports.getSchemaByType = getSchemaByType;
function loggerNotSupport(msg, params) {
    const { index, method, object, type } = params || {};
    console.info({
        msg,
        index,
        type,
        method,
        controller: object.constructor.name
    });
}
/**获取ts运行时类型数据 */
function getGenerator(compilerOptions) {
    const { pattern = 'src/controller/**/*.ts', tsCompilerOptions = {} } = compilerOptions;
    const tsConfig = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'tsconfig.json'), { encoding: 'utf8' }));
    const program = typescript_json_schema_1.getProgramFromFiles(glob.sync(pattern), Object.assign(Object.assign({}, tsConfig.compilerOptions), tsCompilerOptions), process.cwd());
    const generator = typescript_json_schema_1.buildGenerator(program, { required: true }, tsConfig.include);
    return generator;
}
exports.getGenerator = getGenerator;
/**生成schemas数据 */
function generatorToSchemasByStorage(generator, storage, compilerOptions) {
    const schemas = {};
    if (!generator)
        return schemas;
    const { refPointerPrefix = '#/components/schemas/' } = compilerOptions;
    const supportParams = ['query', 'queries', 'header', 'headers', 'body', 'body-param', 'param'];
    storage.params.forEach((param) => {
        const { index, object, method, type: paramType } = param;
        if (supportParams.indexOf(paramType) === -1)
            return;
        const type = Reflect.getMetadata(decorators_1.DESIGN_PARAM_TYPES, object, method)[index];
        const schema = getSchemaByType(type, param);
        const $ref = schema.items ? schema.items.$ref : schema.$ref;
        if ($ref && _.isString($ref)) {
            const schemaName = _.last(_.split($ref, '/'));
            schemNameToSchemas(schemas, generator, schemaName, refPointerPrefix);
        }
    });
    storage.actions.forEach(action => {
        const { target, method } = action;
        const type = Reflect.getMetadata(decorators_1.DESIGN_RETURN_TYPE, target.prototype, method);
        const schema = getSchemaByType(type);
        const $ref = schema.items ? schema.items.$ref : schema.$ref;
        if ($ref && _.isString($ref)) {
            const schemaName = _.last(_.split($ref, '/'));
            schemNameToSchemas(schemas, generator, schemaName, refPointerPrefix);
        }
    });
    return schemas;
}
exports.generatorToSchemasByStorage = generatorToSchemasByStorage;
/**
 * 遍历json-schema并找到其子json-schema加入到schemas
 */
function schemNameToSchemas(schemas, generator, schemaName, refPointerPrefix) {
    if (schemas[schemaName])
        return schemas;
    const definition = generator.getSchemaForSymbol(schemaName);
    (function fn(schemas, definitions = {}) {
        Object.keys(definitions).map(name => {
            const scope = definitions[name];
            if (!schemas[name] && _.isObject(scope)) {
                const definitionsScope = scope.definitions;
                delete scope.definitions;
                schemas[name] = JSON.parse(JSON.stringify(scope).replace(/#\/definitions\//g, refPointerPrefix));
                fn(schemas, definitionsScope);
            }
        });
    })(schemas, { [schemaName]: definition });
    return schemas;
}
/**
 * 展开下parameters schema参数
 */
function transParameters(spec, generator) {
    if (!generator)
        return spec;
    Object.keys(spec.paths).forEach(path => {
        Object.keys(spec.paths[path]).forEach(method => {
            const operation = spec.paths[path][method];
            const { parameters } = operation;
            if (!parameters)
                return;
            const cache = _.reduce(parameters, (cache, item) => {
                const { name, schema, in: type } = item;
                const schemaName = schema && schema.$ref ? _.last(_.split(schema.$ref, '/')) : '';
                if (!cache[type]) {
                    cache[type] = [[], []];
                }
                if (schemaName) {
                    if (schemaName === name) {
                        const definition = generator.getSchemaForSymbol(schemaName);
                        const { properties = {}, required = [] } = definition;
                        cache[type][1] = Object.keys(properties).map(name => {
                            const schema = properties[name];
                            return {
                                in: type,
                                name: name,
                                required: _.includes(required, name),
                                description: schema.description,
                                schema: schema
                            };
                        });
                    }
                    else {
                        cache[type][0].push(Object.assign(Object.assign({}, item), { description: schema.description }));
                    }
                }
                else {
                    cache[type][0].push(Object.assign(Object.assign({}, item), { description: schema.description }));
                }
                return cache;
            }, {});
            operation.parameters = _(cache).values().map(r => _.uniqBy([...r[0], ...r[1]], 'name')).flatten().value();
        });
    });
    return spec;
}
exports.transParameters = transParameters;
