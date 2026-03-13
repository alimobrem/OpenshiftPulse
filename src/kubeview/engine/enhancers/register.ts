import { registerEnhancer } from './index';
import { podEnhancer } from './pods';
import { deploymentEnhancer } from './deployments';
import { nodeEnhancer } from './nodes';
import { serviceEnhancer } from './services';
import { secretEnhancer } from './secrets';

export function registerBuiltinEnhancers(): void {
  registerEnhancer(podEnhancer);
  registerEnhancer(deploymentEnhancer);
  registerEnhancer(nodeEnhancer);
  registerEnhancer(serviceEnhancer);
  registerEnhancer(secretEnhancer);
}
