import * as _ from 'lodash';
import * as pathToRegexp from 'path-to-regexp';
import 'reflect-metadata';
import { OpenAPIObject, PathObject, OperationObject, ParameterObject, ReferenceObject, ParameterLocation, SchemaObject, RequestBodyObject, ResponsesObject } from 'openapi3-ts';
import { ParamMetadataArgs } from 'routing-controllers/metadata/args/ParamMetadataArgs';
import { applyOpenAPIDecorator, DESIGN_RETURN_TYPE, DESIGN_PARAM_TYPES } from './decorators';
import { IRoute, getSchemaByType } from './compile';

export function getSpec(routes: IRoute[]): OpenAPIObject {
    return {
        components: { schemas: {} },
        info: { title: 'routing-controllers to openapi3', version: '1.0.0' },
        openapi: '3.0.0',
        paths: getPaths(routes)
    };
}

function getPaths(routes: IRoute[]): PathObject {
    const transRoutes = routes.map(route => {
        const path = getFullPath(route);
        return {
            [path]: {
                [route.action.type]: getOperation(route)
            }
        }
    });
    return _.merge({}, ...transRoutes);
}
function getFullPath(route: IRoute): string {
    return expressToOpenAPIPath(getFullExpressPath(route));
}
function expressToOpenAPIPath(expressPath: string) {
    const tokens = pathToRegexp.parse(expressPath);
    return tokens.map(d => (_.isString(d) ? d : `${d.prefix}{${d.name}}`)).join('');
}
function getFullExpressPath(route: IRoute): string {
    const { action, controller, options } = route;
    return `${options.routePrefix || ''}${controller.route || ''}${action.route || ''}`;
}
function getOperation(route: IRoute): OperationObject {
    const operation: OperationObject = {
        tags: getTags(route),
        summary: getSummary(route),
        operationId: getOperationId(route),
        parameters: [
            ...getQueryParams(route),
            ...getHeadParams(route),
            ...getPathParams(route)
        ],
        requestBody: getRequestBody(route) || undefined,
        responses: getResponses(route)
    };
    const cleanedOperation = _.omitBy(operation, _.isEmpty) as OperationObject;
    return applyOpenAPIDecorator(cleanedOperation, route);
}
function getTags(route: IRoute): string[] {
    return [route.controller.target.name.replace(/Controller$/, '')]
    // return [_.startCase(route.controller.target.name.replace(/Controller$/, ''))]
}
function getSummary(route: IRoute): string {
    return route.action.method
    // return _.capitalize(_.startCase(route.action.method))
}
function getOperationId(route: IRoute): string {
    return `${route.action.target.name}.${route.action.method}`;
}
function getQueryParams(route: IRoute): (ParameterObject | ReferenceObject)[] {
    const params = _(route.params).filter(param => param.type === 'query').map(param => ({
        in: 'query' as ParameterLocation,
        name: param.name || '',
        required: isRequired(param, route),
        schema: getParamSchema(param) as SchemaObject
    })).uniqBy('name').value();

    const param = _.find(route.params, param => param.type === 'queries');
    if (param) {
        const schema = getParamSchema(param) as ReferenceObject;
        params.push({
            in: 'query' as ParameterLocation,
            name: _.last(_.split(schema.$ref, '/')) || '',
            required: isRequired(param, route),
            schema: schema
        });
    }
    return params;
}
function getHeadParams(route: IRoute): (ParameterObject | ReferenceObject)[] {
    const params = _(route.params).filter(param => param.type === 'header').map(param => ({
        in: 'header' as ParameterLocation,
        name: param.name || '',
        required: isRequired(param, route),
        schema: getParamSchema(param) as SchemaObject
    })).uniqBy('name').value();

    const param = _.find(route.params, param => param.type === 'headers');
    if (param) {
        const schema = getParamSchema(param) as ReferenceObject;
        params.push({
            in: 'header' as ParameterLocation,
            name: _.last(_.split(schema.$ref, '/')) || '',
            required: isRequired(param, route),
            schema: schema
        });
    }
    return params;
}
function getPathParams(route: IRoute): (ParameterObject | ReferenceObject)[] {
    const tokens = pathToRegexp.parse(getFullExpressPath(route));
    const params = _(tokens).filter(_.isObject).map((token: pathToRegexp.Key) => {
        let schema: SchemaObject = { type: 'string' };
        if (token.pattern && token.pattern !== '[^\\/]+?') {
            schema = { ...schema, pattern: token.pattern };
        }
        const meta = _.find(route.params, { name: `${token.name || ''}`, type: 'param' });
        if (meta) {
            const metaSchema = getParamSchema(meta) as SchemaObject;
            schema = 'type' in metaSchema ? { ...schema, ...metaSchema } : metaSchema;
        }
        return {
            in: 'path' as ParameterLocation,
            name: `${token.name || ''}`,
            required: !(token.modifier === '?' || token.modifier === '*'),
            schema
        }
    }).uniqBy('name').value();
    return params as any;
}
function getRequestBody(route: IRoute): RequestBodyObject | void {
    const bodyParamsSchema: SchemaObject | null = _(route.params).filter(param => param.type === 'body-param').reduce((pre: SchemaObject | null, param) => {
        if (!pre) {
            pre = { properties: {}, required: [], type: 'object' };
        }
        const schema = getParamSchema(param) as SchemaObject;
        if (param.name) {
            pre = {
                ...pre,
                properties: {
                    ...pre.properties,
                    [param.name]: schema
                },
                required: isRequired(param, route) ? [...(pre.required || []), param.name] : pre.required
            }
        }
        return pre;
    }, null);
    const param = _.find(route.params, param => param.type === 'body');
    if (param) {
        const schema = getParamSchema(param);
        const { $ref } = 'items' in schema && schema.items ? schema.items : schema;
        return {
            content: {
                'application/json': {
                    schema: bodyParamsSchema ? { allOf: [schema, bodyParamsSchema] } : schema
                }
            },
            description: _.last(_.split($ref, '/')),
            required: isRequired(param, route)
        }
    } else if (bodyParamsSchema) {
        return {
            content: { 'application/json': { schema: bodyParamsSchema } }
        }
    }
}
function getResponses(route: IRoute): ResponsesObject {
    const contentType = getContentType(route);
    const successStatus = getStatusCode(route);
    const { action } = route;
    const responseType = Reflect.getMetadata(DESIGN_RETURN_TYPE, action.target.prototype, action.method);
    const schema = getSchemaByType(responseType);
    return {
        [successStatus]: {
            content: { [contentType]: { schema } },
            description: 'Successful response'
        }
    }
}
function getParamSchema(param: ParamMetadataArgs): SchemaObject | ReferenceObject {
    const { index, object, method } = param;
    const type = Reflect.getMetadata(DESIGN_PARAM_TYPES, object, method)[index];
    return getSchemaByType(type, param);
}

/**
 * Return true if given metadata argument is required 
 * checking for global setting if local setting is not defined.
 */
function isRequired(meta: { required?: boolean }, route: IRoute) {
    const globalRequired = _.get(route.options, 'defaults.paramOptions.required');
    return globalRequired ? meta.required !== false : !!meta.required;
}
/**
 * Return the content type of given route.
 */
export function getContentType(route: IRoute): string {
    const defaultContentType = route.controller.type === 'json' ? 'application/json' : 'text/html; charset=utf-8';
    const contentMeta = _.find(route.responseHandlers, { type: 'content-type' });
    return contentMeta ? contentMeta.value : defaultContentType;
}

/**
 * Return the status code of given route.
 */
export function getStatusCode(route: IRoute): string {
    const successMeta = _.find(route.responseHandlers, { type: 'success-code' });
    return successMeta ? successMeta.value + '' : '200';
}
