import { forward } from '../_proxy.js';
export const onRequest = (ctx) => forward(ctx, 'https://api.planespotters.net/pub/photos/');
