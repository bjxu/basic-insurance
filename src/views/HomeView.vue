<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <section class="hero">
    <h1>Know roughly what you'd pay &mdash; before you talk to anyone.</h1>
    <p class="lede">
      Basic Insurance is a small tool for comparing rough monthly premium estimates across
      health, car, and home cover, based on your age, coverage amount, and deductible.
    </p>
    <RouterLink to="/compare" class="cta">Get an estimate</RouterLink>
    <p class="disclaimer">
      Figures are illustrative only, computed locally in your browser from a simplified
      formula &mdash; they are not quotes from any insurer.
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
