<script setup>
defineProps({
  title: {
    type: String,
    required: true,
  },
  subtitle: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    default: '',
  },
  expanded: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits([
  'open',
  'close',
])
</script>

<template>
  <article class="relative flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition">
    
    <!-- HEADER -->
    <div class="shrink-0 p-4">
      <p class="text-xs font-semibold uppercase tracking-wider text-slate-500">
        {{ subtitle }}
      </p>

      <h3 class="mt-1 text-base font-semibold text-slate-900">
        {{ title }}
      </h3>
    </div>

    <!-- CONTENUTO -->
    <div
      class="min-h-0 flex-1 px-4 pb-4"
    >
      <div
        class="h-full min-h-0 overflow-auto rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600"
      >
        <slot />
      </div>
    </div>

    <!-- OVERLAY INFORMATIVO -->
    <button
      v-if="!expanded"
      type="button"
      class="group absolute inset-0 z-20 flex cursor-pointer items-center justify-center bg-slate-950/0 p-6 text-left transition-all duration-200 hover:bg-slate-950/20 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset"
      @click="emit('open')"
    >
      <div
        class="w-full max-w-sm rounded-xl border border-white/60 bg-white/95 p-5 opacity-0 shadow-xl backdrop-blur transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus:translate-y-0 group-focus:opacity-100"
      >
        <p class="text-xs font-semibold uppercase tracking-wider text-blue-600">
          {{ subtitle }}
        </p>

        <h4 class="mt-1 text-lg font-semibold text-slate-900">
          {{ title }}
        </h4>

        <p
          v-if="description"
          class="mt-2 text-sm leading-6 text-slate-600"
        >
          {{ description }}
        </p>

        <p class="mt-4 text-xs font-medium text-blue-600">
          Click anywhere to open
        </p>

      </div>

    </button>

    <!-- BOTTONE CHIUSURA-->
    <button
      v-if="expanded"
      type="button"
      class="absolute right-4 top-4 z-30 flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-lg text-slate-600 shadow-sm transition hover:bg-slate-100 hover:text-slate-900"
      aria-label="Close panel"
      @click="emit('close')"
    >
      ×
    </button>
  </article>
</template>

