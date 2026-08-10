<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <section class="hero">
    <h1>Know what you'd actually pay &mdash; before you talk to anyone.</h1>
    <p class="lede">
      Basic Insurance compares real, official monthly premiums for Swiss mandatory
      health insurance (KVG/OKP), based on your age, deductible, accident coverage, and
      exact municipality.
    </p>
    <RouterLink to="/compare" class="cta">Compare premiums</RouterLink>
    <p class="disclaimer">
      Figures are published by Switzerland's Federal Office of Public Health (BAG) and
      priminfo.admin.ch &mdash; not estimates.
    </p>
  </section>
</template>

<style scoped>
.hero {
  max-width: 640px;
}

.lede {
  color: var(--color-text-muted);
  font-size: 1.05rem;
}

.cta {
  display: inline-block;
  margin-top: 0.5rem;
  padding: 0.65rem 1.25rem;
  background-color: var(--color-accent);
  color: var(--color-accent-contrast);
  border-radius: 6px;
  text-decoration: none;
  font-weight: 600;
}

.disclaimer {
  margin-top: 1.5rem;
  font-size: 0.8rem;
  color: var(--color-text-muted);
}
</style>
