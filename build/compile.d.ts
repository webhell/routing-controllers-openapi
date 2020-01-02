import "reflect-metadata";
import { SchemaObject, ReferenceObject, OpenAPIObject } from 'openapi3-ts';
import { JsonSchemaGenerator } from 'typescript-json-schema';
import { MetadataArgsStorage, RoutingControllersOptions } from 'routing-controllers';
import { ParamMetadataArgs } from 'routing-controllers/metadata/args/ParamMetadataArgs';
import { ActionMetadataArgs } from "routing-controllers/metadata/args/ActionMetadataArgs";
import { ControllerMetadataArgs } from "routing-controllers/metadata/args/ControllerMetadataArgs";
import { ResponseHandlerMetadataArgs } from "routing-controllers/metadata/args/ResponseHandleMetadataArgs";
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
    tsCompilerOptions?: {
        [key: string]: any;
    };
    /**
     * 默认'#/components/schemas/'
     */
    refPointerPrefix?: string;
}
declare type ISchemas = {
    [schema: string]: SchemaObject | ReferenceObject;
};
export interface IRoute {
    readonly action: ActionMetadataArgs;
    readonly controller: ControllerMetadataArgs;
    readonly options: RoutingControllersOptions;
    readonly params: ParamMetadataArgs[];
    readonly responseHandlers: ResponseHandlerMetadataArgs[];
}
/**将routing-controllers元数据解析为IRoute对象数组 */
export declare function parseRoutes(storage: MetadataArgsStorage, options?: RoutingControllersOptions): IRoute[];
export declare function getSchemaByType(type: any, param?: ParamMetadataArgs): SchemaObject | ReferenceObject;
/**获取ts运行时类型数据 */
export declare function getGenerator(compilerOptions: ICompilerOptions): JsonSchemaGenerator | null;
/**生成schemas数据 */
export declare function generatorToSchemasByStorage(generator: JsonSchemaGenerator | null, storage: MetadataArgsStorage, compilerOptions: ICompilerOptions): ISchemas;
/**
 * 展开下parameters schema参数
 */
export declare function transParameters(spec: OpenAPIObject, generator: JsonSchemaGenerator | null): OpenAPIObject;
/**
 *
 */
export declare function transResponse(spec: OpenAPIObject, compilerOptions: ICompilerOptions): OpenAPIObject;
export {};
