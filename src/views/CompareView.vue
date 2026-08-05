<script setup lang="ts">
import { computed, reactive } from 'vue'
import { estimatePremium, type InsuranceType } from '../lib/estimate'

const form = reactive({
  type: 'health' as InsuranceType,
  age: 35,
  coverageAmount: 50_000,
  deductible: 500,
})

const currency = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'CHF',
  maximumFractionDigits: 2,
})

const result = computed(() => estimatePremium({ ...form }))

const insuranceTypes: { value: InsuranceType; label: string }[] = [
  { value: 'health', label: 'Health' },
  { value: 'car', label: 'Car' },
  { value: 'home', label: 'Home' },
]
</script>

<template>
  <section class="compare">
    <h1>Compare premiums</h1>
    <p class="disclaimer">
      This is a simplified, local estimate for demo purposes &mdash; not a real quote.
    </p>

    <form class="form" @submit.prevent>
      <fieldset class="field">
        <legend>Insurance type</legend>
        <label v-for="option in insuranceTypes" :key="option.value" class="radio">
          <input v-model="form.type" type="radio" name="type" :value="option.value" />
          {{ option.label }}
        </label>
      </fieldset>

      <label class="field">
        Age
        <input v-model.number="form.age" type="number" min="16" max="100" required />
      </label>

      <label class="field">
        Coverage amount (CHF)
        <input
          v-model.number="form.coverageAmount"
          type="number"
          min="0"
          step="1000"
          required
        />
      </label>

      <label class="field">
        Deductible (CHF)
        <input v-model.number="form.deductible" type="number" min="0" step="100" required />
      </label>
    </form>

    <div class="result" role="status">
      <p class="result-label">Estimated premium</p>
      <p class="result-value">{{ currency.format(result.monthlyPremium) }} / month</p>
      <p class="result-sub">{{ currency.format(result.annualPremium) }} / year</p>
    </div>
  </section>
</template>

<style scoped>
.compare {
  max-width: 560px;
}

.disclaimer {
  font-size: 0.85rem;
  color: var(--color-text-muted);
  margin-bottom: 1.5rem;
}

.form {
  display: grid;
  gap: 1.1rem;
  padding: 1.25rem;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
}

.field {
  display: grid;
  gap: 0.35rem;
  border: none;
  padding: 0;
  margin: 0;
  font-weight: 600;
  font-size: 0.9rem;
}

fieldset.field {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 1rem;
}

fieldset.field legend {
  font-weight: 600;
  font-size: 0.9rem;
  padding: 0;
}

.radio {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-weight: 400;
}

input[type='number'] {
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background-color: var(--color-bg);
  color: var(--color-text);
  font-size: 1rem;
}

.result {
  margin-top: 1.5rem;
  padding: 1.25rem;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  text-align: center;
}

.result-label {
  margin: 0;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
}

.result-value {
  margin: 0.25rem 0 0;
  font-size: 2rem;
  font-weight: 700;
  color: var(--color-accent);
}

.result-sub {
  margin: 0.25rem 0 0;
  color: var(--color-text-muted);
}
</style>
