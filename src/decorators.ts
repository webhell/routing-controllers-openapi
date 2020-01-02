import * as _ from 'lodash';
import 'reflect-metadata';
import { OperationObject, SchemaObject } from 'openapi3-ts';
import { IRoute } from './compile';
import { getContentType, getStatusCode } from './generate';

const OPEN_API_KEY = Symbol('routing-controllers-openapi:OpenAPI');
export const DESIGN_PARAM_TYPES = 'design:paramtypes';
export const DESIGN_RETURN_TYPE = 'design:returntype';

interface IOperationObject extends Partial<OperationObject> {
    paramTypes?: any[];
    returnType?: any;
}
export type OpenAPIParam = | Partial<OperationObject> | ((source: OperationObject, route: IRoute) => OperationObject)

export function ParamTypes(types: any[]) {
    return (target: object, key: string, descriptor: PropertyDescriptor) => {
        const parameters = Reflect.getMetadata(DESIGN_PARAM_TYPES, target, key);
        types.map((type, i) => {
            if (type !== undefined) {
                parameters[i] = type;
            }
        });
        Reflect.defineMetadata(DESIGN_PARAM_TYPES, parameters, target, key);
    }
}
export function ReturnType(type: any) {
    return (target: object, key: string, descriptor: PropertyDescriptor) => {
        Reflect.defineMetadata(DESIGN_RETURN_TYPE, type, target, key);
    }
}

/**
 * Supplement action with additional OpenAPI Operation keywords.
 *
 * @param spec OpenAPI Operation object that is merged into the schema derived
 * from routing-controllers decorators. In case of conflicts, keywords defined
 * here overwrite the existing ones. Alternatively you can supply a function
 * that receives as parameters the existing Operation and target route,
 * returning an updated Operation.
 */
export function OpenAPI(spec: IOperationObject | OpenAPIParam) {

    let paramTypes: any[];
    let returnType: any;
    if (_.isObject(spec)) {
        spec = spec as IOperationObject;
        paramTypes = spec.paramTypes;
        returnType = spec.returnType;
        delete spec.paramTypes;
        delete spec.returnType;

    }
    return (...args: [Function] | [object, string, PropertyDescriptor]) => {
        if (args.length === 1) {
            const [target] = args;
            const currentMeta = getOpenAPIMetadata(target);
            setOpenAPIMetadata([spec, ...currentMeta], target);
        } else {
            const [target, key] = args;
            const currentMeta = getOpenAPIMetadata(target, key);
            setOpenAPIMetadata([spec, ...currentMeta], target, key);

            if (paramTypes) {
                ParamTypes(paramTypes).apply(null, args);
            }
            if (returnType) {
                ReturnType(returnType).apply(null, args);
            }
        }
    }
}

/**
 * Apply the keywords defined in @OpenAPI decorator to its target route.
 */
export function applyOpenAPIDecorator(
    originalOperation: OperationObject,
    route: IRoute
): OperationObject {
    const { action } = route
    const openAPIParams = [
        ...getOpenAPIMetadata(action.target),
        ...getOpenAPIMetadata(action.target.prototype, action.method)
    ]

    return openAPIParams.reduce((acc: OperationObject, oaParam: OpenAPIParam) => {
        return _.isFunction(oaParam)
            ? oaParam(acc, route)
            : _.merge({}, acc, oaParam)
    }, originalOperation) as OperationObject
}

/**
 * Get the OpenAPI Operation object stored in given target property's metadata.
 */
function getOpenAPIMetadata(target: object, key?: string): OpenAPIParam[] {
    return ((key
        ? Reflect.getMetadata(OPEN_API_KEY, target.constructor, key)
        : Reflect.getMetadata(OPEN_API_KEY, target)) || []);
}
/**
 * Store given OpenAPI Operation object into target property's metadata.
 */
function setOpenAPIMetadata(value: OpenAPIParam[], target: object, key?: string) {
    return key
        ? Reflect.defineMetadata(OPEN_API_KEY, value, target.constructor, key)
        : Reflect.defineMetadata(OPEN_API_KEY, value, target);
}
/**
 * Supplement action with response body type annotation.
 */
export function TransRespons(transFun: (schema: SchemaObject, source: OperationObject, route: IRoute) => SchemaObject) {
    const setResponse = (source: OperationObject, route: IRoute) => {
        const statusCode = getStatusCode(route);
        const contentType = getContentType(route);
        const schemaKey = ['responses', statusCode, 'content', contentType, 'schema'].join('.');
        const schema: SchemaObject = _.get(source, schemaKey);
        if (schema !== undefined) {
            _.set(source, schemaKey, transFun(schema, source, route));
        }
        return source;
    };
    return OpenAPI(setResponse);
}
