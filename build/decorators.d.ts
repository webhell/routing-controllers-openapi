import 'reflect-metadata';
import { OperationObject, SchemaObject } from 'openapi3-ts';
import { IRoute } from './compile';
export declare const DESIGN_PARAM_TYPES = "design:paramtypes";
export declare const DESIGN_RETURN_TYPE = "design:returntype";
interface IOperationObject extends Partial<OperationObject> {
    paramTypes?: any[];
    returnType?: any;
}
export declare type OpenAPIParam = Partial<OperationObject> | ((source: OperationObject, route: IRoute) => OperationObject);
export declare function ParamTypes(types: any[]): (target: object, key: string, descriptor: PropertyDescriptor) => void;
export declare function ReturnType(type: any): (target: object, key: string, descriptor: PropertyDescriptor) => void;
/**
 * Supplement action with additional OpenAPI Operation keywords.
 *
 * @param spec OpenAPI Operation object that is merged into the schema derived
 * from routing-controllers decorators. In case of conflicts, keywords defined
 * here overwrite the existing ones. Alternatively you can supply a function
 * that receives as parameters the existing Operation and target route,
 * returning an updated Operation.
 */
export declare function OpenAPI(spec: IOperationObject | OpenAPIParam): (...args: [Function] | [object, string, PropertyDescriptor]) => void;
/**
 * Apply the keywords defined in @OpenAPI decorator to its target route.
 */
export declare function applyOpenAPIDecorator(originalOperation: OperationObject, route: IRoute): OperationObject;
/**
 * Supplement action with response body type annotation.
 */
export declare function TransRespons(transFun: (schema: SchemaObject, source: OperationObject, route: IRoute) => SchemaObject): (...args: [Function] | [object, string, PropertyDescriptor]) => void;
export {};
