// Ambient module declaration for `@polyguard/sdk`. The npm package ships
// pre-bundled JS without .d.ts files; we re-use the constructor type we
// already maintain in lib/polyguard.ts so the rest of the codebase keeps
// its strong typing on the SDK surface.

declare module '@polyguard/sdk' {
  import type { PolyguardClientConstructor } from '@/lib/polyguard';
  export const PolyguardClient: PolyguardClientConstructor;
  const _default: PolyguardClientConstructor;
  export default _default;
}
