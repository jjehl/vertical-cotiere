<script setup lang="ts">
withDefaults(defineProps<{id:string;label:string;autocomplete?:string;minlength?:number;disabled?:boolean}>(),{autocomplete:'new-password'});
const model=defineModel<string>({default:''});
const visible=ref(false);
</script>
<template>
  <div class="auth-field">
    <div class="auth-label-row"><label :for="id">{{label}}</label><slot/></div>
    <div class="auth-password">
      <input :id="id" v-model="model" :type="visible?'text':'password'" :autocomplete="autocomplete" :minlength="minlength" :maxlength="autocomplete==='new-password'?72:undefined" required :disabled="disabled">
      <button type="button" class="auth-eye" :disabled="disabled" :aria-label="(visible?'Masquer : ':'Afficher : ')+label" :aria-pressed="visible" :aria-controls="id" @click="visible=!visible">
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/><path v-if="visible" d="m4 3 16 18"/></svg>
      </button>
    </div>
  </div>
</template>
