```
import { routingControllersToSpec } from '@webhell/routing-controllers-openapi';
import { getMetadataArgsStorage } from "routing-controllers";
const spec = routingControllersToSpec(getMetadataArgsStorage(), {
    pattern: 'src/controller/**/*.ts',
    compilerOptions: {
        tsCompilerOptions: { strictNullChecks: false, skipLibCheck: true }
    },
    refPointerPrefix: '#/components/schemas/'
});
```