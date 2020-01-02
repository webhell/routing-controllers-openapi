```
import { routingControllersToSpec } from '@webhell/routing-controllers-openapi';
import { getMetadataArgsStorage } from "routing-controllers";
const spec = routingControllersToSpec(getMetadataArgsStorage(), {
    pattern: 'src/controller/**/*.ts',
    tsCompilerOptions: { strictNullChecks: false, skipLibCheck: true },
    refPointerPrefix: '#/components/schemas/',
    transResponseFun: (schema: SchemaObject, source: OperationObject, route: IRoute): SchemaObject => ({
        type: 'object',
        properties: {
            retCode: { type: 'number', description: '0正常' },
            retMsg: { type: 'string', description: '描述失败原因' },
            data: {...schema, description: '业务数据'}
        },
        required: ['retCode', 'retMsg', 'data']
    })
});
```