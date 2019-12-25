"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const _ = require("lodash");
const pathToRegexp = require("path-to-regexp");
require("reflect-metadata");
const decorators_1 = require("./decorators");
const compile_1 = require("./compile");
function getSpec(routes) {
    return {
        components: { schemas: {} },
        info: { title: 'routing-controllers to openapi3', version: '1.0.0' },
        openapi: '3.0.0',
        paths: getPaths(routes)
    };
}
exports.getSpec = getSpec;
function getPaths(routes) {
    const transRoutes = routes.map(route => {
        const path = getFullPath(route);
        return {
            [path]: {
                [route.action.type]: getOperation(route)
            }
        };
    });
    return _.merge({}, ...transRoutes);
}
function getFullPath(route) {
    return expressToOpenAPIPath(getFullExpressPath(route));
}
function expressToOpenAPIPath(expressPath) {
    const tokens = pathToRegexp.parse(expressPath);
    return tokens.map(d => (_.isString(d) ? d : `${d.prefix}{${d.name}}`)).join('');
}
function getFullExpressPath(route) {
    const { action, controller, options } = route;
    return `${options.routePrefix || ''}${controller.route || ''}${action.route || ''}`;
}
function getOperation(route) {
    const operation = {
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
    const cleanedOperation = _.omitBy(operation, _.isEmpty);
    return decorators_1.applyOpenAPIDecorator(cleanedOperation, route);
}
function getTags(route) {
    return [route.controller.target.name.replace(/Controller$/, '')];
    // return [_.startCase(route.controller.target.name.replace(/Controller$/, ''))]
}
function getSummary(route) {
    return route.action.method;
    // return _.capitalize(_.startCase(route.action.method))
}
function getOperationId(route) {
    return `${route.action.target.name}.${route.action.method}`;
}
function getQueryParams(route) {
    const params = _(route.params).filter(param => param.type === 'query').map(param => ({
        in: 'query',
        name: param.name || '',
        required: isRequired(param, route),
        schema: getParamSchema(param)
    })).uniqBy('name').value();
    const param = _.find(route.params, param => param.type === 'queries');
    if (param) {
        const schema = getParamSchema(param);
        params.push({
            in: 'query',
            name: _.last(_.split(schema.$ref, '/')) || '',
            required: isRequired(param, route),
            schema: schema
        });
    }
    return params;
}
function getHeadParams(route) {
    const params = _(route.params).filter(param => param.type === 'header').map(param => ({
        in: 'header',
        name: param.name || '',
        required: isRequired(param, route),
        schema: getParamSchema(param)
    })).uniqBy('name').value();
    const param = _.find(route.params, param => param.type === 'headers');
    if (param) {
        const schema = getParamSchema(param);
        params.push({
            in: 'header',
            name: _.last(_.split(schema.$ref, '/')) || '',
            required: isRequired(param, route),
            schema: schema
        });
    }
    return params;
}
function getPathParams(route) {
    const tokens = pathToRegexp.parse(getFullExpressPath(route));
    const params = _(tokens).filter(_.isObject).map((token) => {
        let schema = { type: 'string' };
        if (token.pattern && token.pattern !== '[^\\/]+?') {
            schema = Object.assign(Object.assign({}, schema), { pattern: token.pattern });
        }
        const meta = _.find(route.params, { name: `${token.name || ''}`, type: 'param' });
        if (meta) {
            const metaSchema = getParamSchema(meta);
            schema = 'type' in metaSchema ? Object.assign(Object.assign({}, schema), metaSchema) : metaSchema;
        }
        return {
            in: 'path',
            name: `${token.name || ''}`,
            required: !(token.modifier === '?' || token.modifier === '*'),
            schema
        };
    }).uniqBy('name').value();
    return params;
}
function getRequestBody(route) {
    const bodyParamsSchema = _(route.params).filter(param => param.type === 'body-param').reduce((pre, param) => {
        if (!pre) {
            pre = { properties: {}, required: [], type: 'object' };
        }
        const schema = getParamSchema(param);
        if (param.name) {
            pre = Object.assign(Object.assign({}, pre), { properties: Object.assign(Object.assign({}, pre.properties), { [param.name]: schema }), required: isRequired(param, route) ? [...(pre.required || []), param.name] : pre.required });
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
        };
    }
    else if (bodyParamsSchema) {
        return {
            content: { 'application/json': { schema: bodyParamsSchema } }
        };
    }
}
function getResponses(route) {
    const contentType = getContentType(route);
    const successStatus = getStatusCode(route);
    const { action } = route;
    const responseType = Reflect.getMetadata(decorators_1.DESIGN_RETURN_TYPE, action.target.prototype, action.method);
    const schema = compile_1.getSchemaByType(responseType);
    return {
        [successStatus]: {
            content: { [contentType]: { schema } },
            description: 'Successful response'
        }
    };
}
function getParamSchema(param) {
    const { index, object, method } = param;
    const type = Reflect.getMetadata(decorators_1.DESIGN_PARAM_TYPES, object, method)[index];
    return compile_1.getSchemaByType(type, param);
}
/**
 * Return true if given metadata argument is required
 * checking for global setting if local setting is not defined.
 */
function isRequired(meta, route) {
    const globalRequired = _.get(route.options, 'defaults.paramOptions.required');
    return globalRequired ? meta.required !== false : !!meta.required;
}
/**
 * Return the content type of given route.
 */
function getContentType(route) {
    const defaultContentType = route.controller.type === 'json' ? 'application/json' : 'text/html; charset=utf-8';
    const contentMeta = _.find(route.responseHandlers, { type: 'content-type' });
    return contentMeta ? contentMeta.value : defaultContentType;
}
exports.getContentType = getContentType;
/**
 * Return the status code of given route.
 */
function getStatusCode(route) {
    const successMeta = _.find(route.responseHandlers, { type: 'success-code' });
    return successMeta ? successMeta.value + '' : '200';
}
exports.getStatusCode = getStatusCode;
