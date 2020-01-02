import * as glob from 'glob';
import * as fs from 'fs';
import * as path from 'path';
import * as _ from 'lodash';
import "reflect-metadata";
import { SchemaObject, ReferenceObject, OpenAPIObject, OperationObject, ParameterObject } from 'openapi3-ts';
import { getProgramFromFiles, buildGenerator, JsonSchemaGenerator, Definition } from 'typescript-json-schema';
import { MetadataArgsStorage, RoutingControllersOptions } from 'routing-controllers';
import { ParamMetadataArgs } from 'routing-controllers/metadata/args/ParamMetadataArgs';
import { ActionMetadataArgs } from "routing-controllers/metadata/args/ActionMetadataArgs";
import { ControllerMetadataArgs } from "routing-controllers/metadata/args/ControllerMetadataArgs";
import { ResponseHandlerMetadataArgs } from "routing-controllers/metadata/args/ResponseHandleMetadataArgs";
import { DESIGN_PARAM_TYPES, DESIGN_RETURN_TYPE, TransRespons } from './decorators';

export interface ICompilerOptions {
    /**
     * https://github.com/isaacs/node-glob
     * node-glob规则,类型定义文件路径,相对工作目录解析 process.pwd()
     * 默认工作目录下src\/controller\/**\/*.ts
     */
    pattern?: string;
    /**
     * http://www.typescriptlang.org/docs/handbook/compiler-options-in-msbuild.html
     * 此配置默认会assign工作目录下的tsconfig.json的compilerOptions
     * eg: { strictNullChecks:false, skipLibCheck: true }
     */
    tsCompilerOptions?: { [key: string]: any };
    /**
     * 默认'#/components/schemas/'
     */
    refPointerPrefix?: string;
    /**
     * 批量修改响应 response schema
     */
    transResponseFun?: (schema: SchemaObject, source: OperationObject, route: IRoute) => SchemaObject;
}
type ISchemas = { [schema: string]: SchemaObject | ReferenceObject }

export interface IRoute {
    readonly action: ActionMetadataArgs
    readonly controller: ControllerMetadataArgs
    readonly options: RoutingControllersOptions
    readonly params: ParamMetadataArgs[]
    readonly responseHandlers: ResponseHandlerMetadataArgs[]
}

/**将routing-controllers元数据解析为IRoute对象数组 */
export function parseRoutes(
    storage: MetadataArgsStorage,
    options: RoutingControllersOptions = {},
    compilerOptions: ICompilerOptions = {}
): IRoute[] {
    const routes = storage.actions.map(action => ({
        action,
        controller: _.find(storage.controllers, { target: action.target }) as ControllerMetadataArgs,
        options,
        params: _.sortBy(storage.filterParamsWithTargetAndMethod(action.target, action.method), 'index'),
        responseHandlers: storage.filterResponseHandlersWithTargetAndMethod(action.target, action.method)
    }));
    const { transResponseFun } = compilerOptions;
    if (transResponseFun) {
        storage.controllers.map(controller => {
            TransRespons(transResponseFun).apply(null, [controller.target]);
        });
    }
    return routes;
}

export function getSchemaByType(type: any, param?: ParamMetadataArgs): SchemaObject | ReferenceObject {
    const refPointerPrefix = '#/components/schemas/';
    if (param && param.explicitType) {
        const reference = { $ref: refPointerPrefix + param.explicitType.name };
        if (_.isFunction(type) && type.name === 'Array') {
            return {
                type: 'array',
                items: reference
            }
        }
        return reference;
    }
    let schema = {};
    if (_.isArray(type)) {
        schema = {
            type: 'array',
            items: getSchemaByType(type[0])
        }
    } else if (_.isFunction(type)) {
        if (_.isString(type.prototype) || _.isSymbol(type.prototype)) {
            schema = { type: 'string' }
        } else if (_.isNumber(type.prototype)) {
            schema = { type: 'number' }
        } else if (_.isBoolean(type.prototype)) {
            schema = { type: 'boolean' }
        } else if (type.name === 'Array') {
            loggerNotSupport(`type Array not support`, param);
            schema = { type: 'array' }
        } else if (type.name === 'Object') {
            loggerNotSupport(`type Object not support`, param);
            schema = { type: 'object' }
        } else {
            schema = { $ref: refPointerPrefix + type.name }
        }
    } else if (_.isString(type) && type) {
        const JsType = ['string', 'number', 'boolean', 'null', 'any'];
        if (JsType.indexOf(type) > -1) {
            schema = { type: JsType }
        } else {
            schema = { $ref: refPointerPrefix + type }
        }
    } else {
        loggerNotSupport(`type Any not support`, param);
        schema = { type: 'any' }
    }
    return schema;
}

function loggerNotSupport(msg: string, params?: ParamMetadataArgs) {
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
export function getGenerator(compilerOptions: ICompilerOptions): JsonSchemaGenerator | null {
    const { pattern = 'src/controller/**/*.ts', tsCompilerOptions = {} } = compilerOptions;
    const tsConfig: any = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'tsconfig.json'), { encoding: 'utf8' }));
    const program = getProgramFromFiles(glob.sync(pattern), {
        ...tsConfig.compilerOptions,
        ...tsCompilerOptions
    }, process.cwd());
    const generator = buildGenerator(program, { required: true }, tsConfig.include);
    return generator;
}

/**生成schemas数据 */
export function generatorToSchemasByStorage(generator: JsonSchemaGenerator | null, storage: MetadataArgsStorage, compilerOptions: ICompilerOptions): ISchemas {
    const schemas: ISchemas = {};
    if (!generator) return schemas;
    const { refPointerPrefix = '#/components/schemas/' } = compilerOptions;
    const supportParams = ['query', 'queries', 'header', 'headers', 'body', 'body-param', 'param'];
    storage.params.forEach((param: ParamMetadataArgs) => {
        const { index, object, method, type: paramType } = param;
        if (supportParams.indexOf(paramType) === -1) return;
        const type = Reflect.getMetadata(DESIGN_PARAM_TYPES, object, method)[index];
        const schema = getSchemaByType(type, param) as SchemaObject;
        const $ref = schema.items ? schema.items.$ref : schema.$ref;
        if ($ref && _.isString($ref)) {
            const schemaName = _.last(_.split($ref, '/')) as string;
            schemNameToSchemas(schemas, generator, schemaName, refPointerPrefix);
        }
    });
    storage.actions.forEach(action => {
        const { target, method } = action;
        const type = Reflect.getMetadata(DESIGN_RETURN_TYPE, target.prototype, method);
        const schema = getSchemaByType(type) as SchemaObject;
        const $ref = schema.items ? schema.items.$ref : schema.$ref;
        if ($ref && _.isString($ref)) {
            const schemaName = _.last(_.split($ref, '/')) as string;
            schemNameToSchemas(schemas, generator, schemaName, refPointerPrefix);
        }
    });
    return schemas;
}
/**
 * 遍历json-schema并找到其子json-schema加入到schemas
 */
function schemNameToSchemas(schemas: ISchemas, generator: JsonSchemaGenerator, schemaName: string, refPointerPrefix: string): ISchemas {
    if (schemas[schemaName]) return schemas;
    const definition: Definition = generator.getSchemaForSymbol(schemaName);
    (function fn(schemas: ISchemas, definitions: { [key: string]: Definition } = {}): void {
        Object.keys(definitions).map(name => {
            const scope: Definition = definitions[name];
            if (!schemas[name] && _.isObject(scope)) {
                const definitionsScope = scope.definitions as { [key: string]: Definition };
                delete scope.definitions;
                schemas[name] = JSON.parse(JSON.stringify(scope).replace(
                    /#\/definitions\//g,
                    refPointerPrefix
                ));
                fn(schemas, definitionsScope);
            }
        });
    })(schemas, { [schemaName]: definition });
    return schemas;
}

/**
 * 展开下parameters schema参数
 */
export function transParameters(spec: OpenAPIObject, generator: JsonSchemaGenerator | null): OpenAPIObject {
    if (!generator) return spec;
    Object.keys(spec.paths).forEach(path => {
        Object.keys(spec.paths[path]).forEach(method => {
            const operation = spec.paths[path][method] as OperationObject;
            const { parameters } = operation;
            if (!parameters) return;
            const cache = _.reduce(parameters, (cache: any, item: ParameterObject | ReferenceObject) => {
                const { name, schema, in: type } = item as ParameterObject;
                const schemaName = schema && schema.$ref ? _.last(_.split(schema.$ref, '/')) : '';
                if (!cache[type]) {
                    cache[type] = [[], []];
                }
                if (schemaName) {
                    if (schemaName === name) {
                        const definition = generator.getSchemaForSymbol(schemaName);
                        const { properties = {}, required = [] } = definition;
                        cache[type][1] = Object.keys(properties).map(name => {
                            const schema = properties[name] as Definition;
                            return {
                                in: type,
                                name: name,
                                required: _.includes(required, name),
                                description: schema.description,
                                schema: schema
                            }
                        });
                    } else {
                        cache[type][0].push({
                            ...item,
                            description: (schema as Definition).description
                        });
                    }
                } else {
                    cache[type][0].push({
                        ...item,
                        description: (schema as Definition).description
                    });
                }
                return cache;
            }, {});
            operation.parameters = _(cache).values().map(r => _.uniqBy([...r[0], ...r[1]], 'name')).flatten().value();
        });
    });
    return spec;
}
