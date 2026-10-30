export default {
  resolve: { alias: { '@': new URL('../../../../', import.meta.url).pathname } },
  test: { environment:'jsdom', include:['.agents/phases/ph_f16b2b8b06/contracts-v2/ui.contract.test.tsx','tests/ui/*.test.tsx'], fileParallelism:false },
};
