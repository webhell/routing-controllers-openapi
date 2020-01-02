"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const _ = require("lodash");
require("reflect-metadata");
const OPEN_API_KEY = Symbol('routing-controllers-openapi:OpenAPI');
exports.DESIGN_PARAM_TYPES = 'design:paramtypes';
exports.DESIGN_RETURN_TYPE = 'design:returntype';
function ParamTypes(types) {
    return (target, key, descriptor) => {
        const parameters = Reflect.getMetadata(exports.DESIGN_PARAM_TYPES, target, key);
        types.map((type, i) => {
            if (type !== undefined) {
                parameters[i] = type;
            }
        });
        Reflect.defineMetadata(exports.DESIGN_PARAM_TYPES, parameters, target, key);
    };
}
exports.ParamTypes = ParamTypes;
function ReturnType(type) {
    return (target, key, descriptor) => {
        Reflect.defineMetadata(exports.DESIGN_RETURN_TYPE, type, target, key);
    };
}
exports.ReturnType = ReturnType;
/**
 * Supplement action with additional OpenAPI Operation keywords.
 *
 * @param spec OpenAPI Operation object that is merged into the schema derived
 * from routing-controllers decorators. In case of conflicts, keywords defined
 * here overwrite the existing ones. Alternatively you can supply a function
 * that receives as parameters the existing Operation and target route,
 * returning an updated Operation.
 */
function OpenAPI(spec) {
    let paramTypes;
    let returnType;
    if (_.isObject(spec)) {
        spec = spec;
        paramTypes = spec.paramTypes;
        returnType = spec.returnType;
        delete spec.paramTypes;
        delete spec.returnType;
    }
    return (...args) => {
        if (args.length === 1) {
            const [target] = args;
            const currentMeta = getOpenAPIMetadata(target);
            setOpenAPIMetadata([spec, ...currentMeta], target);
        }
        else {
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
    };
}
exports.OpenAPI = OpenAPI;
/**
 * Apply the keywords defined in @OpenAPI decorator to its target route.
 */
function applyOpenAPIDecorator(originalOperation, route) {
    const { action } = route;
    const openAPIParams = [
        ...getOpenAPIMetadata(action.target),
        ...getOpenAPIMetadata(action.target.prototype, action.method)
    ];
    return openAPIParams.reduce((acc, oaParam) => {
        return _.isFunction(oaParam)
            ? oaParam(acc, route)
            : _.merge({}, acc, oaParam);
    }, originalOperation);
}
exports.applyOpenAPIDecorator = applyOpenAPIDecorator;
/**
 * Get the OpenAPI Operation object stored in given target property's metadata.
 */
function getOpenAPIMetadata(target, key) {
    return ((key
        ? Reflect.getMetadata(OPEN_API_KEY, target.constructor, key)
        : Reflect.getMetadata(OPEN_API_KEY, target)) || []);
}
/**
 * Store given OpenAPI Operation object into target property's metadata.
 */
function setOpenAPIMetadata(value, target, key) {
    return key
        ? Reflect.defineMetadata(OPEN_API_KEY, value, target.constructor, key)
        : Reflect.defineMetadata(OPEN_API_KEY, value, target);
}
