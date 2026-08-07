<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { estimatePremium, type InsuranceType } from '../lib/estimate'
import {
  ageToAgeClass,
  getHealthPremiums,
  loadPremiumsData,
  type HealthQuoteResult,
  type PremiumsData,
} from '../lib/health-premiums'

const form = reactive({
  type: 'health' as InsuranceType,
  age: 35,
  // health only
  canton: 'ZH',
  franchise: 300,
  accidentIncluded: true,
  // car/home only
  coverageAmount: 50_000,
  deductible: 500,
})

const currency = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'CHF',
  maximumFractionDigits: 2,
})

const insuranceTypes: { value: InsuranceType; label: string }[] = [
  { value: 'health', label: 'Health' },
  { value: 'car', label: 'Car' },
  { value: 'home', label: 'Home' },
]

// --- Car/home: placeholder local formula (see src/lib/estimate.ts) -----------------
const placeholderResult = computed(() => estimatePremium({ ...form }))

// --- Health: real BAG premium data --------------------------------------------------
const premiums = ref<PremiumsData | null>(null)
const premiumsError = ref<string | null>(null)
const healthResult = ref<HealthQuoteResult | null>(null)

const ageClass = computed(() => ageToAgeClass(form.age))
const franchiseOptions = computed(
  () => premiums.value?.ageClasses[ageClass.value]?.franchises ?? [],
)
const cantonOptions = computed(() =>
  premiums.value ? Object.entries(premiums.value.cantons).sort((a, b) => a[1].localeCompare(b[1])) : [],
)

// Keep the selected franchise valid when age crosses an age-class boundary (children,
// young adults, and adults each have a different allowed set of deductibles).
watch(
  [ageClass, () => premiums.value],
  ([newAgeClass]) => {
    const opts = premiums.value?.ageClasses[newAgeClass]?.franchises
    if (opts && !opts.includes(form.franchise)) form.franchise = opts[0]!
  },
)

watch(
  [() => form.type, () => form.age, () => form.canton, () => form.franchise, () => form.accidentIncluded],
  async () => {
    if (form.type !== 'health') return
    try {
      healthResult.value = await getHealthPremiums({
        canton: form.canton,
        age: form.age,
        franchise: form.franchise,
        accidentIncluded: form.accidentIncluded,
      })
      premiumsError.value = null
    } catch (err) {
      premiumsError.value = err instanceof Error ? err.message : String(err)
    }
  },
  { immediate: true },
)

onMounted(async () => {
  try {
    premiums.value = await loadPremiumsData()
  } catch (err) {
    premiumsError.value = err instanceof Error ? err.message : String(err)
  }
})
</script>

<template>
  <section class="compare">
    <h1>Compare premiums</h1>

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
        <input v-model.number="form.age" type="number" min="0" max="100" required />
      </label>

      <template v-if="form.type === 'health'">
        <label class="field">
          Canton
          <select v-model="form.canton" required>
            <option v-for="[code, name] in cantonOptions" :key="code" :value="code">
              {{ name }} ({{ code }})
            </option>
          </select>
        </label>

        <label class="field">
          Deductible / Franchise (CHF)
          <select v-model.number="form.franchise" required>
            <option v-for="amount in franchiseOptions" :key="amount" :value="amount">
              {{ currency.format(amount) }}
            </option>
          </select>
        </label>

        <label class="field checkbox-field">
          <input v-model="form.accidentIncluded" type="checkbox" />
          Include accident coverage
        </label>
        <p class="field-hint">
          Leave this off if accidents are already covered through an employer (common
          for anyone working &ge;8h/week in Switzerland).
        </p>
      </template>

      <template v-else>
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
      </template>
    </form>

    <div v-if="form.type === 'health'" class="result-block">
      <p v-if="premiumsError" class="error">Couldn't load premium data: {{ premiumsError }}</p>
      <template v-else-if="healthResult">
        <div v-if="healthResult.cheapest" class="result" role="status">
          <p class="result-label">Cheapest available</p>
          <p class="result-value">{{ currency.format(healthResult.cheapest.monthlyPremium) }} / month</p>
          <p class="result-sub">{{ healthResult.cheapest.insurerName }}</p>
          <p v-if="healthResult.medianPremium" class="result-sub">
            Median across {{ healthResult.quotes.length }} insurers:
            {{ currency.format(healthResult.medianPremium) }} / month
          </p>
        </div>
        <p v-else class="result-empty">No premiums found for this combination.</p>

        <table v-if="healthResult.quotes.length > 1" class="quote-table">
          <caption>Cheapest 5 insurers</caption>
          <thead>
            <tr>
              <th scope="col">Insurer</th>
              <th scope="col">Monthly premium</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="quote in healthResult.quotes.slice(0, 5)" :key="quote.insurerCode">
              <td>{{ quote.insurerName }}</td>
              <td>{{ currency.format(quote.monthlyPremium) }}</td>
            </tr>
          </tbody>
        </table>

        <p class="disclaimer">
          {{ premiums?.premiumYear }} mandatory health insurance (KVG/OKP) premiums,
          published by the
          <a :href="premiums?.sourceDataset" target="_blank" rel="noopener">Federal Office of
          Public Health (BAG)</a>. Cheapest premium found per insurer in your canton,
          across premium regions and insurance models (standard, HMO, family-doctor,
          etc.) &mdash; not specific to your municipality, and excludes supplementary
          insurance.
        </p>
      </template>
      <p v-else class="result-empty">Loading premium data&hellip;</p>
    </div>

    <div v-else class="result-block">
      <div class="result" role="status">
        <p class="result-label">Estimated premium</p>
        <p class="result-value">{{ currency.format(placeholderResult.monthlyPremium) }} / month</p>
        <p class="result-sub">{{ currency.format(placeholderResult.annualPremium) }} / year</p>
      </div>
      <p class="disclaimer">
        This is a simplified, local placeholder estimate for demo purposes &mdash; not a
        real quote from any insurer. (Only health insurance uses real published data so
        far &mdash; see the Health option.)
      </p>
    </div>
  </section>
</template>

<style scoped>
.compare {
  max-width: 560px;
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

.checkbox-field {
  display: flex;
  flex-direction: row-reverse;
  justify-content: flex-end;
  align-items: center;
  gap: 0.5rem;
}

.field-hint {
  margin: -0.6rem 0 0;
  font-size: 0.78rem;
  font-weight: 400;
  color: var(--color-text-muted);
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

input[type='number'],
select {
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background-color: var(--color-bg);
  color: var(--color-text);
  font-size: 1rem;
  font-family: inherit;
}

.result-block {
  margin-top: 1.5rem;
}

.result {
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

.result-empty {
  color: var(--color-text-muted);
  font-style: italic;
}

.error {
  color: #c0392b;
}

.quote-table {
  width: 100%;
  margin-top: 1rem;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.quote-table caption {
  text-align: left;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
  margin-bottom: 0.4rem;
}

.quote-table th,
.quote-table td {
  text-align: left;
  padding: 0.4rem 0.5rem;
  border-bottom: 1px solid var(--color-border);
}

.quote-table td:last-child,
.quote-table th:last-child {
  text-align: right;
}

.disclaimer {
  margin-top: 1rem;
  font-size: 0.8rem;
  color: var(--color-text-muted);
}
</style>
