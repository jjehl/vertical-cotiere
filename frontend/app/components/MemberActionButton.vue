<script setup lang="ts">
const paths={
  add:'M12 5v14M5 12h14',
  edit:'m14.5 5.5 4 4M4 20l4.5-1 12-12a2.83 2.83 0 0 0-4-4l-12 12L4 20Z',
  trash:'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7m4-7v7',
  check:'m4.5 12 5 5 10-10',
  search:'M16 10a6 6 0 1 1-12 0 6 6 0 0 1 12 0Zm-1.5 4.5 5.5 5.5',
  previous:'m14.5 6-6 6 6 6',
  next:'m9.5 6 6 6-6 6',
  upload:'M12 15V3m-5 5 5-5 5 5M4 15v5h16v-5',
  download:'M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4',
} as const;
withDefaults(defineProps<{
  icon?:keyof typeof paths;
  tone?:'primary'|'secondary'|'quiet'|'danger';
  type?:'button'|'submit';
}>(),{tone:'secondary',type:'button'});
</script>
<template>
  <button :type="type" class="directory-action" :class="'directory-action--'+tone">
    <svg v-if="icon" :class="{trailing:icon==='next'}" aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path :d="paths[icon]"/></svg>
    <slot/>
  </button>
</template>
<style scoped>
.directory-action {
  display:inline-flex;align-items:center;justify-content:center;gap:.5rem;justify-self:start;
  min-height:42px;max-width:100%;padding:.6rem .95rem;border:1px solid #bdc8ba;border-radius:9px;
  background:#fffefa;color:var(--forest);font:600 .875rem/1.3 var(--sans);cursor:pointer;
  transition:background-color .15s,border-color .15s,box-shadow .15s;
}
.directory-action svg {flex:none}
.trailing {order:1}
.directory-action:hover:enabled {background:#edf2e9;border-color:#8a9f8d}
.directory-action--primary {color:white;background:var(--forest);border-color:var(--forest);box-shadow:0 1px 2px #172c261a}
.directory-action--primary:hover:enabled {background:#355444;border-color:#355444}
.directory-action--quiet {background:transparent;border-color:transparent;color:#515e52}
.directory-action--quiet:hover:enabled {background:#e9ede4;border-color:transparent}
.directory-action--danger {background:#fff9f5;color:#953d28;border-color:#dfbdaa}
.directory-action--danger:hover:enabled {background:#fbe7db;border-color:#bd846d}
.directory-action:active:enabled {box-shadow:inset 0 1px 3px #172c2629}
.directory-action:focus-visible {outline:2px solid var(--forest);outline-offset:3px}
.directory-action:disabled {opacity:.5;cursor:default}
@media(pointer:coarse){.directory-action {min-height:44px}}
@media(prefers-reduced-motion:reduce){.directory-action {transition:none}}
</style>
